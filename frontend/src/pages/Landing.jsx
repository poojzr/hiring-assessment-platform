import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Shield, Video, Users, BarChart3, Clock, CheckCircle, 
  ChevronRight, Menu, X, Zap, 
  Eye, Monitor, AlertTriangle, FileText, UserCheck,
  Sliders, Calendar, FileQuestion, LayoutDashboard,
  Mail, Phone, Twitter, Linkedin, Github, Youtube,
  ArrowRight, Sparkles, TrendingUp
} from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import ThemeToggle from '../components/ThemeToggle'
import ContactModal from '../components/ContactModal'

export default function Landing() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isVisible, setIsVisible] = useState({})

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
      
      const sections = ['hero', 'about', 'features', 'howitworks', 'proctoring', 'cta']
      sections.forEach((key) => {
        const element = document.getElementById(key)
        if (element) {
          const rect = element.getBoundingClientRect()
          const isVisible = rect.top < window.innerHeight * 0.75
          setIsVisible(prev => ({ ...prev, [key]: isVisible }))
        }
      })
    }
    
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    setIsMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const openContact = () => {
    setIsMenuOpen(false)
    setIsContactOpen(true)
  }

  const features = [
    { icon: LayoutDashboard, title: 'Admin Dashboard', desc: 'Complete user management, question bank, template creation, and threshold configuration.' },
    { icon: Users, title: 'Manager Dashboard', desc: 'Session management, candidate monitoring, eligibility shortlisting, and analytics.' },
    { icon: UserCheck, title: 'Candidate Management', desc: 'Create, edit, and manage candidates with ATS scoring and job role mapping.' },
    { icon: FileQuestion, title: 'Question Bank', desc: 'MCQ and coding questions with difficulty levels, topics, and bulk import.' },
    { icon: FileText, title: 'Assessment Templates', desc: 'Create custom assessment templates with sections, duration, and pass thresholds.' },
    { icon: Sliders, title: 'ATS Thresholds', desc: 'Configure job role thresholds for automatic candidate shortlisting.' },
  ]

  const proctoringFeatures = [
    { icon: Eye, title: 'Face Detection', desc: 'Real-time face tracking with liveness detection' },
    { icon: Monitor, title: 'Screen Recording', desc: 'Full screen capture with activity monitoring' },
    { icon: AlertTriangle, title: 'Tab & Copy Detection', desc: 'Real-time tab switch and copy-paste prevention' },
    { icon: Shield, title: 'Audio Monitoring', desc: 'Background noise and voice detection' },
    { icon: Video, title: 'Violation Detection', desc: 'Automated detection of suspicious activities' },
    { icon: CheckCircle, title: 'Integrity Scoring', desc: 'Comprehensive integrity score for each candidate' },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-dark-900 transition-colors duration-300">
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled ? 'bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl shadow-lg border-b border-gray-100/50 dark:border-dark-700/50' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => scrollToSection('hero')}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-accent-400 to-accent-600 rounded-xl flex items-center justify-center shadow-lg shadow-accent-500/30 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden="true" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">HireAssess</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('hero')} className="text-sm text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 transition-all duration-300 relative group" aria-label="Go to home">
                Home
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent-500 group-hover:w-full transition-all duration-300" aria-hidden="true"></span>
              </button>
              <button onClick={() => scrollToSection('about')} className="text-sm text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 transition-all duration-300 relative group" aria-label="Go to about section">
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent-500 group-hover:w-full transition-all duration-300" aria-hidden="true"></span>
              </button>
              <button onClick={() => scrollToSection('features')} className="text-sm text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 transition-all duration-300 relative group" aria-label="Go to features section">
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent-500 group-hover:w-full transition-all duration-300" aria-hidden="true"></span>
              </button>
              <button onClick={() => scrollToSection('howitworks')} className="text-sm text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 transition-all duration-300 relative group" aria-label="Go to how it works section">
                How It Works
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent-500 group-hover:w-full transition-all duration-300" aria-hidden="true"></span>
              </button>
              <button onClick={openContact} className="text-sm text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 transition-all duration-300 relative group" aria-label="Open contact form">
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent-500 group-hover:w-full transition-all duration-300" aria-hidden="true"></span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <Link to="/login" className="text-sm text-navy-700 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 transition-all duration-300 font-medium group" aria-label="Sign in to your account">
                Sign In
                <span className="block max-w-0 group-hover:max-w-full transition-all duration-300 h-0.5 bg-accent-500" aria-hidden="true"></span>
              </Link>
              <Link to="/login" className="bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg shadow-accent-500/30 hover:shadow-accent-500/50 hover:scale-105" aria-label="Get started with HireAssess">
                Get Started
              </Link>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMenuOpen ? <X className="w-6 h-6 text-navy-800 dark:text-white" aria-hidden="true" /> : <Menu className="w-6 h-6 text-navy-800 dark:text-white" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <div className="md:hidden bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-dark-700 py-4 px-4 space-y-3">
              <button onClick={() => scrollToSection('hero')} className="block w-full text-left text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 py-2">Home</button>
              <button onClick={() => scrollToSection('about')} className="block w-full text-left text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 py-2">About</button>
              <button onClick={() => scrollToSection('features')} className="block w-full text-left text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 py-2">Features</button>
              <button onClick={() => scrollToSection('howitworks')} className="block w-full text-left text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 py-2">How It Works</button>
              <button onClick={openContact} className="block w-full text-left text-gray-600 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 py-2">Contact</button>
              <div className="pt-4 border-t border-gray-100 dark:border-dark-700 space-y-3">
                <Link to="/login" className="block w-full text-center text-navy-700 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 font-medium py-2">Sign In</Link>
                <Link to="/login" className="block w-full text-center bg-gradient-to-r from-accent-500 to-accent-600 text-white py-2.5 rounded-lg font-medium">Get Started</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      <section id="hero" className="relative pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-accent-50/30 to-white dark:from-dark-900 dark:via-accent-900/10 dark:to-dark-900" aria-hidden="true"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className={`transition-all duration-1000 transform ${isVisible.hero ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <Badge variant="primary" className="mb-4 inline-block">
                <Sparkles className="w-3 h-3 inline mr-1" aria-hidden="true" />
                Enterprise Assessment Platform
              </Badge>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-navy-800 dark:text-white leading-tight">
                Smart Hiring{' '}
                <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">
                  Assessments
                </span>
                <br />
                <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl">with AI Proctoring</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                Complete assessment platform with real-time proctoring, candidate management, 
                and advanced analytics for technical hiring.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/login" aria-label="Get started with HireAssess">
                  <Button size="lg" className="group bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 shadow-lg shadow-accent-500/30 hover:shadow-accent-500/50 transition-all duration-300 hover:scale-105">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </Button>
                </Link>
                <button 
                  onClick={() => scrollToSection('features')}
                  className="px-6 py-3 border-2 border-gray-300 dark:border-dark-600 hover:border-accent-500 text-gray-700 dark:text-gray-300 hover:text-accent-500 dark:hover:text-accent-400 rounded-lg text-sm font-medium transition-all duration-300 hover:bg-accent-50 dark:hover:bg-accent-900/20"
                  aria-label="Explore features"
                >
                  Explore Features
                </button>
              </div>
            </div>

            <div className={`relative transition-all duration-1000 delay-300 transform ${isVisible.hero ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <div className="absolute -inset-4 bg-gradient-to-r from-accent-500/20 to-accent-600/20 rounded-3xl blur-2xl" aria-hidden="true"></div>
              <div className="relative bg-white dark:bg-dark-800 rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-accent-100 to-accent-200 dark:from-accent-900/50 dark:to-accent-800/50 rounded-xl flex items-center justify-center" aria-hidden="true">
                    <LayoutDashboard className="w-7 h-7 text-accent-600 dark:text-accent-400" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-semibold text-navy-800 dark:text-white text-lg">Platform Overview</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Complete assessment solution</div>
                  </div>
                  <span className="ml-auto px-3 py-1.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">Live</span>
                </div>
                
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-800 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Sessions</span>
                    <span className="text-2xl font-bold text-accent-600 dark:text-accent-400">12</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Today's Candidates</span>
                    <span className="text-2xl font-bold text-navy-800 dark:text-white">48</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Completion Rate</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">94%</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-xl text-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto mb-1" aria-hidden="true" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">Face Detection</span>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-xl text-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mx-auto mb-1" aria-hidden="true" />
                    <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Tab Tracking</span>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl text-center">
                    <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" aria-hidden="true" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Screen Share</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 sm:py-28 px-4 bg-white dark:bg-dark-900">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 transform ${isVisible.about ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <Badge variant="primary" className="mb-4">About HireAssess</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-navy-800 dark:text-white">
              Built for <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">Modern Hiring</span>
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
              HireAssess is a complete hiring assessment platform designed for enterprises 
              to conduct secure, proctored technical assessments.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            <div className={`text-center p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-white dark:from-dark-800 dark:to-dark-900 border border-gray-100 dark:border-dark-700 hover:shadow-xl transition-all duration-500 hover:-translate-y-2 ${isVisible.about ? 'opacity-100' : 'opacity-0'}`}>
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg" aria-hidden="true">
                <Shield className="w-10 h-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-navy-800 dark:text-white mb-3">Secure Proctoring</h3>
              <p className="text-gray-500 dark:text-gray-400">AI-powered integrity monitoring for fair assessments</p>
            </div>

            <div className={`text-center p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-white dark:from-dark-800 dark:to-dark-900 border border-gray-100 dark:border-dark-700 hover:shadow-xl transition-all duration-500 hover:-translate-y-2 ${isVisible.about ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '150ms' }}>
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg" aria-hidden="true">
                <Users className="w-10 h-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-navy-800 dark:text-white mb-3">Complete Management</h3>
              <p className="text-gray-500 dark:text-gray-400">End-to-end candidate and assessment management</p>
            </div>

            <div className={`text-center p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-white dark:from-dark-800 dark:to-dark-900 border border-gray-100 dark:border-dark-700 hover:shadow-xl transition-all duration-500 hover:-translate-y-2 ${isVisible.about ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '300ms' }}>
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg" aria-hidden="true">
                <TrendingUp className="w-10 h-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-navy-800 dark:text-white mb-3">Data-Driven Insights</h3>
              <p className="text-gray-500 dark:text-gray-400">Detailed analytics for better hiring decisions</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 sm:py-28 px-4 bg-gradient-to-b from-gray-50 to-white dark:from-dark-800 dark:to-dark-900">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 transform ${isVisible.features ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <Badge variant="primary" className="mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-navy-800 dark:text-white">
              Complete Assessment <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">Platform</span>
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300 text-lg">Everything you need for secure, proctored technical assessments</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className={`group bg-white dark:bg-dark-800 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 p-6 border border-gray-100 dark:border-dark-700 hover:border-accent-200 dark:hover:border-accent-700 flex flex-col h-full ${isVisible.features ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${index * 100}ms` }}>
                <div className="w-14 h-14 bg-gradient-to-br from-accent-100 to-accent-200 dark:from-accent-900/50 dark:to-accent-800/50 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <feature.icon className="w-7 h-7 text-accent-600 dark:text-accent-400" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-navy-800 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 flex-1">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="howitworks" className="py-20 sm:py-28 px-4 bg-white dark:bg-dark-900">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 transform ${isVisible.howitworks ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <Badge variant="primary" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-navy-800 dark:text-white">
              Simple <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">4-Step</span> Process
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300 text-lg">From assessment creation to hiring decision in minutes</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Create Assessment', desc: 'Build custom assessments using templates or create from scratch' },
              { step: '02', title: 'Invite Candidates', desc: 'Send assessment links via email with secure access tokens' },
              { step: '03', title: 'Live Proctoring', desc: 'Monitor candidates with real-time face detection and screen tracking' },
              { step: '04', title: 'Evaluate & Hire', desc: 'Review reports and shortlist the best candidates' },
            ].map((item, index) => (
              <div key={index} className={`bg-white dark:bg-dark-800 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 p-8 border border-gray-100 dark:border-dark-700 flex flex-col h-full ${isVisible.howitworks ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${index * 150}ms` }}>
                <div className="text-5xl font-bold text-accent-500 dark:text-accent-400 mb-4" aria-hidden="true">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-navy-800 dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 flex-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="proctoring" className="py-20 sm:py-28 px-4 bg-gradient-to-b from-gray-50 to-white dark:from-dark-800 dark:to-dark-900">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 transform ${isVisible.proctoring ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <Badge variant="warning" className="mb-4">Proctoring Suite</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-navy-800 dark:text-white">
              AI-Powered <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">Integrity</span> Monitoring
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300 text-lg">Ensure assessment integrity with comprehensive proctoring features</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {proctoringFeatures.map((feature, index) => (
              <div key={index} className={`group bg-white dark:bg-dark-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 p-6 border border-gray-100 dark:border-dark-700 hover:border-accent-200 dark:hover:border-accent-700 flex items-start gap-5 ${isVisible.proctoring ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${index * 80}ms` }}>
                <div className="w-12 h-12 bg-gradient-to-br from-accent-100 to-accent-200 dark:from-accent-900/50 dark:to-accent-800/50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <feature.icon className="w-6 h-6 text-accent-600 dark:text-accent-400" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="font-bold text-navy-800 dark:text-white text-base">{feature.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="py-20 sm:py-28 px-4 bg-navy-900 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent-500/10 to-transparent" aria-hidden="true"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-r from-accent-500/10 to-transparent" aria-hidden="true"></div>
        <div className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-700 transform ${isVisible.cta ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Ready to Transform Your Hiring Process?
          </h2>
          <p className="mt-4 text-gray-300 text-lg max-w-2xl mx-auto">
            Start conducting secure, proctored technical assessments today
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/login" aria-label="Get started with HireAssess">
              <Button size="lg" className="group bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 shadow-lg shadow-accent-500/30 hover:shadow-accent-500/50 transition-all duration-300 hover:scale-105 text-white">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Button>
            </Link>
            <button 
              onClick={openContact}
              className="px-6 py-3 border-2 border-gray-600 hover:border-accent-500 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-300 hover:bg-accent-500/10"
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-navy-950 text-gray-400 py-16 sm:py-20 px-4 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-400 to-accent-600 rounded-xl flex items-center justify-center shadow-lg shadow-accent-500/30" aria-hidden="true">
                  <Zap className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-xl font-bold text-white">HireAssess</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                Complete hiring assessment platform with AI proctoring for modern enterprises.
              </p>
              <div className="flex gap-4 mt-6">
                <a href="#" className="text-gray-500 hover:text-accent-500 transition-all duration-300 hover:scale-110" aria-label="Twitter">
                  <Twitter className="w-5 h-5" aria-hidden="true" />
                </a>
                <a href="#" className="text-gray-500 hover:text-accent-500 transition-all duration-300 hover:scale-110" aria-label="LinkedIn">
                  <Linkedin className="w-5 h-5" aria-hidden="true" />
                </a>
                <a href="#" className="text-gray-500 hover:text-accent-500 transition-all duration-300 hover:scale-110" aria-label="GitHub">
                  <Github className="w-5 h-5" aria-hidden="true" />
                </a>
                <a href="#" className="text-gray-500 hover:text-accent-500 transition-all duration-300 hover:scale-110" aria-label="YouTube">
                  <Youtube className="w-5 h-5" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Platform</h4>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-accent-500 transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('howitworks')} className="hover:text-accent-500 transition-colors">How It Works</button></li>
                <li><button onClick={() => scrollToSection('proctoring')} className="hover:text-accent-500 transition-colors">Proctoring</button></li>
                <li><Link to="/login" className="hover:text-accent-500 transition-colors">Sign In</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Resources</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/login" className="hover:text-accent-500 transition-colors">Admin Dashboard</Link></li>
                <li><Link to="/login" className="hover:text-accent-500 transition-colors">Manager Dashboard</Link></li>
                <li><Link to="/login" className="hover:text-accent-500 transition-colors">Candidate Management</Link></li>
                <li><Link to="/login" className="hover:text-accent-500 transition-colors">Question Bank</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Contact</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <button onClick={openContact} className="flex items-center gap-3 hover:text-accent-500 transition-colors">
                    <Mail className="w-4 h-4 text-gray-500" aria-hidden="true" />
                    <span>support@hireassess.com</span>
                  </button>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  <span>+1 (555) 123-4567</span>
                </li>
                <li className="text-gray-500 text-xs mt-2">Mon-Fri: 9:00 AM - 6:00 PM</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800/50 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <p>&copy; 2026 HireAssess. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-accent-500 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-accent-500 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  )
}