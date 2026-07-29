import os
import subprocess
import tempfile
import shutil
import sys
import platform
import requests
import json
import time
from typing import List, Dict, Tuple, Optional
from ..config import settings

SUPPORTED_LANGUAGES = {"python", "javascript", "java", "c", "cpp", "csharp"}

JUDGE0_URL = "https://judge0-ce.p.rapidapi.com/submissions"
JUDGE0_KEY = os.environ.get("JUDGE0_API_KEY", "")

LANGUAGE_MAP = {
    "python": 71,
    "javascript": 63,
    "java": 62,
    "c": 50,
    "cpp": 54,
    "csharp": 51
}

IS_WINDOWS = platform.system() == "Windows"
IS_LINUX = platform.system() == "Linux"

def _get_python_cmd() -> str:
    if IS_WINDOWS:
        return sys.executable
    return "python3"

def _get_node_cmd() -> str:
    return "node"

def _get_java_cmd() -> Tuple[str, str]:
    return "javac", "java"

def _get_gcc_cmd() -> Tuple[str, str]:
    return "gcc", "g++"

def _get_dotnet_cmd() -> str:
    return "dotnet"

def _extract_java_class_name(code: str) -> str:
    import re
    match = re.search(r'public\s+(?:final\s+|abstract\s+)?class\s+(\w+)', code)
    if match:
        return match.group(1)
    match = re.search(r'class\s+(\w+)', code)
    return match.group(1) if match else "Solution"

def _run_python(code: str, stdin_input: str, timeout: int, work_dir: str) -> Tuple[bool, str, str]:
    script_path = os.path.join(work_dir, "solution.py")
    with open(script_path, "w") as f:
        f.write(code)

    env = os.environ.copy()
    env["PYTHONHASHSEED"] = "0"
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"

    try:
        python_cmd = _get_python_cmd()
        cmd = [python_cmd, "-u", script_path]
        
        result = subprocess.run(
            cmd,
            input=stdin_input,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        
        if result.returncode != 0:
            return False, result.stdout, f"Runtime error: {result.stderr.strip()[:500]}"
        return True, result.stdout, None
    except subprocess.TimeoutExpired:
        return False, "", f"Execution timed out after {timeout} seconds"
    except FileNotFoundError:
        return False, "", "Python runtime not available. Please install Python."
    except Exception as e:
        return False, "", f"Execution error: {str(e)}"

def _run_javascript(code: str, stdin_input: str, timeout: int, work_dir: str) -> Tuple[bool, str, str]:
    script_path = os.path.join(work_dir, "solution.js")
    with open(script_path, "w") as f:
        f.write(code)

    env = os.environ.copy()

    try:
        cmd = [_get_node_cmd(), script_path]
        
        result = subprocess.run(
            cmd,
            input=stdin_input,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        
        if result.returncode != 0:
            return False, result.stdout, f"Runtime error: {result.stderr.strip()[:500]}"
        return True, result.stdout, None
    except subprocess.TimeoutExpired:
        return False, "", f"Execution timed out after {timeout} seconds"
    except FileNotFoundError:
        return False, "", "Node.js runtime not available. Please install Node.js."
    except Exception as e:
        return False, "", f"Execution error: {str(e)}"

def _run_java(code: str, stdin_input: str, timeout: int, work_dir: str) -> Tuple[bool, str, str]:
    class_name = _extract_java_class_name(code)
    java_path = os.path.join(work_dir, f"{class_name}.java")
    with open(java_path, "w") as f:
        f.write(code)

    env = os.environ.copy()

    try:
        compile_result = subprocess.run(
            ["javac", java_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if compile_result.returncode != 0:
            return False, "", f"Compilation error: {compile_result.stderr.strip()[:500]}"

        result = subprocess.run(
            ["java", "-cp", work_dir, class_name],
            input=stdin_input,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if result.returncode != 0:
            return False, result.stdout, f"Runtime error: {result.stderr.strip()[:500]}"
        return True, result.stdout, None
    except subprocess.TimeoutExpired:
        return False, "", f"Execution timed out after {timeout} seconds"
    except FileNotFoundError:
        return False, "", "Java runtime not available. Please install JDK."
    except Exception as e:
        return False, "", f"Execution error: {str(e)}"

def _run_c(code: str, stdin_input: str, timeout: int, work_dir: str) -> Tuple[bool, str, str]:
    c_path = os.path.join(work_dir, "solution.c")
    executable = os.path.join(work_dir, "solution")
    with open(c_path, "w") as f:
        f.write(code)

    env = os.environ.copy()

    try:
        compile_result = subprocess.run(
            ["gcc", c_path, "-o", executable],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if compile_result.returncode != 0:
            return False, "", f"Compilation error: {compile_result.stderr.strip()[:500]}"

        result = subprocess.run(
            [executable],
            input=stdin_input,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if result.returncode != 0:
            return False, result.stdout, f"Runtime error: {result.stderr.strip()[:500]}"
        return True, result.stdout, None
    except subprocess.TimeoutExpired:
        return False, "", f"Execution timed out after {timeout} seconds"
    except FileNotFoundError:
        return False, "", "C compiler (gcc) not available. Please install GCC."
    except Exception as e:
        return False, "", f"Execution error: {str(e)}"

def _run_cpp(code: str, stdin_input: str, timeout: int, work_dir: str) -> Tuple[bool, str, str]:
    cpp_path = os.path.join(work_dir, "solution.cpp")
    executable = os.path.join(work_dir, "solution")
    with open(cpp_path, "w") as f:
        f.write(code)

    env = os.environ.copy()

    try:
        compile_result = subprocess.run(
            ["g++", cpp_path, "-o", executable],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if compile_result.returncode != 0:
            return False, "", f"Compilation error: {compile_result.stderr.strip()[:500]}"

        result = subprocess.run(
            [executable],
            input=stdin_input,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if result.returncode != 0:
            return False, result.stdout, f"Runtime error: {result.stderr.strip()[:500]}"
        return True, result.stdout, None
    except subprocess.TimeoutExpired:
        return False, "", f"Execution timed out after {timeout} seconds"
    except FileNotFoundError:
        return False, "", "C++ compiler (g++) not available. Please install G++."
    except Exception as e:
        return False, "", f"Execution error: {str(e)}"

def _run_csharp(code: str, stdin_input: str, timeout: int, work_dir: str) -> Tuple[bool, str, str]:
    project_path = os.path.join(work_dir, "Project.csproj")
    program_path = os.path.join(work_dir, "Program.cs")

    with open(project_path, "w") as f:
        f.write('<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net7.0</TargetFramework>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>disable</Nullable>\n  </PropertyGroup>\n</Project>')
    
    with open(program_path, "w") as f:
        f.write(code)

    env = os.environ.copy()

    try:
        build_result = subprocess.run(
            ["dotnet", "build", "--nologo", "--verbosity", "quiet"],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if build_result.returncode != 0:
            return False, "", f"Compilation error: {build_result.stderr.strip()[:500]}"

        result = subprocess.run(
            ["dotnet", "run", "--no-build", "--nologo"],
            input=stdin_input,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=work_dir,
            env=env,
            shell=False,
        )
        if result.returncode != 0:
            return False, result.stdout, f"Runtime error: {result.stderr.strip()[:500]}"
        return True, result.stdout, None
    except subprocess.TimeoutExpired:
        return False, "", f"Execution timed out after {timeout} seconds"
    except FileNotFoundError:
        return False, "", ".NET SDK (dotnet) not available. Please install .NET SDK."
    except Exception as e:
        return False, "", f"Execution error: {str(e)}"

def _run_single(code: str, language: str, stdin_input: str, timeout: int) -> Tuple[bool, str, str]:
    work_dir = tempfile.mkdtemp(prefix="exec_")
    try:
        if language == "python":
            return _run_python(code, stdin_input, timeout, work_dir)
        elif language == "javascript":
            return _run_javascript(code, stdin_input, timeout, work_dir)
        elif language == "java":
            return _run_java(code, stdin_input, timeout, work_dir)
        elif language == "c":
            return _run_c(code, stdin_input, timeout, work_dir)
        elif language == "cpp":
            return _run_cpp(code, stdin_input, timeout, work_dir)
        elif language == "csharp":
            return _run_csharp(code, stdin_input, timeout, work_dir)
        else:
            return False, "", f"Unsupported language: {language}"
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

def _execute_with_judge0(code: str, language: str, test_cases: List[Dict]) -> Dict:
    if not JUDGE0_KEY:
        return None
    
    language_id = LANGUAGE_MAP.get(language.lower())
    if not language_id:
        return None
    
    results = []
    passed_count = 0
    
    for tc in test_cases:
        stdin_input = str(tc.get("input", "")).strip()
        expected = str(tc.get("expected", "")).strip()
        
        try:
            submission = {
                "source_code": code,
                "language_id": language_id,
                "stdin": stdin_input,
                "expected_output": expected,
                "redirect_stderr_to_stdout": True
            }
            
            response = requests.post(
                JUDGE0_URL,
                json=submission,
                headers={
                    "X-RapidAPI-Key": JUDGE0_KEY,
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            
            if response.status_code == 201:
                token = response.json().get("token")
                
                for i in range(10):
                    result_response = requests.get(
                        f"{JUDGE0_URL}/{token}",
                        headers={"X-RapidAPI-Key": JUDGE0_KEY},
                        timeout=10
                    )
                    
                    if result_response.status_code == 200:
                        data = result_response.json()
                        status_id = data.get("status", {}).get("id")
                        if status_id in [3, 4, 5, 6]:
                            actual = data.get("stdout", "").strip()
                            error = data.get("stderr") or data.get("compile_output")
                            passed = actual == expected and not error
                            
                            results.append({
                                "passed": passed,
                                "input": stdin_input,
                                "expected": expected,
                                "actual": actual,
                                "error": error
                            })
                            if passed:
                                passed_count += 1
                            break
                    
                    if i < 9:
                        time.sleep(0.5 * (i + 1))
            else:
                results.append({
                    "passed": False,
                    "input": stdin_input,
                    "expected": expected,
                    "actual": "",
                    "error": f"Judge0 API error: {response.status_code}"
                })
        except Exception as e:
            results.append({
                "passed": False,
                "input": stdin_input,
                "expected": expected,
                "actual": "",
                "error": str(e)
            })
    
    return {
        "passed": passed_count == len(test_cases) and len(test_cases) > 0,
        "total": len(test_cases),
        "passed_count": passed_count,
        "results": results,
        "error": None,
        "executor": "judge0"
    }

def execute_code(code: str, language: str, test_cases: List[Dict]) -> Dict:
    judge0_result = _execute_with_judge0(code, language, test_cases)
    if judge0_result:
        return judge0_result
    
    if language not in SUPPORTED_LANGUAGES:
        return {
            "passed": False,
            "total": 0,
            "passed_count": 0,
            "results": [],
            "error": f"Unsupported language: {language}. Supported: {', '.join(SUPPORTED_LANGUAGES)}",
            "executor": "local"
        }

    timeout = getattr(settings, 'CODE_EXECUTOR_TIMEOUT', 30)
    
    results = []
    passed_count = 0

    for tc in test_cases:
        stdin_input = str(tc.get("input", "")).strip()
        expected = str(tc.get("expected", "")).strip()
        
        try:
            ran, actual, error = _run_single(code, language, stdin_input, timeout)
        except Exception as e:
            ran = False
            actual = ""
            error = f"Execution exception: {str(e)}"
        
        passed = ran and actual.strip() == expected
        
        results.append({
            "passed": passed,
            "input": stdin_input,
            "expected": expected,
            "actual": actual.strip() if actual else "",
            "error": error,
        })
        if passed:
            passed_count += 1
    
    return {
        "passed": passed_count == len(test_cases) and len(test_cases) > 0,
        "total": len(test_cases),
        "passed_count": passed_count,
        "results": results,
        "error": None,
        "executor": "local"
    }