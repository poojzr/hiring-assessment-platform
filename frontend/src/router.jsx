import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import UsersList from './pages/Users/List'
import UserForm from './pages/Users/Form'
import UserDetail from './pages/Users/Detail'
import QuestionsList from './pages/Questions/List'
import QuestionForm from './pages/Questions/Form'
import QuestionDetail from './pages/Questions/Detail'
import BulkImport from './pages/Questions/BulkImport'
import TemplatesList from './pages/Templates/List'
import TemplateForm from './pages/Templates/Form'
import TemplateDetail from './pages/Templates/Detail'
import TemplateHistory from './pages/Templates/History'
import ThresholdsList from './pages/Thresholds/List'
import ThresholdForm from './pages/Thresholds/Form'
import SessionsList from './pages/Sessions/List'
import SessionCreate from './pages/Sessions/Create'
import SessionViewByToken from './pages/Sessions/ViewByToken'
import BulkSessionCreate from './pages/Sessions/BulkCreate'
import CandidatesList from './pages/Candidates/List'
import CandidateCreate from './pages/Candidates/Create'
import CandidateEdit from './pages/Candidates/Edit'
import CandidateDetail from './pages/Candidates/Detail'
import AssessmentVerify from './pages/Assessment/Verify'
import AssessmentTake from './pages/Assessment/Take'
import AssessmentSubmit from './pages/Assessment/Submit'
import AssessmentThankYou from './pages/Assessment/ThankYou'
import ManagerDashboard from './pages/Manager/Dashboard'
import LiveMonitoring from './pages/Manager/LiveMonitoring'
import CandidateReport from './pages/Manager/CandidateReport'
import EligibleShortlist from './pages/Manager/EligibleShortlist'
import Analytics from './pages/Manager/Analytics'
import Recordings from './pages/Manager/Recordings'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />,
  },
  {
    path: '/reset-password',
    element: <ResetPassword />,
  },
  {
    path: '/assessment/:accessToken',
    element: <AssessmentVerify />,
  },
  {
    path: '/assessment/:accessToken/take',
    element: <AssessmentTake />,
  },
  {
    path: '/assessment/:accessToken/submit',
    element: <AssessmentSubmit />,
  },
  {
    path: '/assessment/:accessToken/thankyou',
    element: <AssessmentThankYou />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/dashboard',
            element: <Dashboard />,
          },
          {
            path: '/users',
            element: <UsersList />,
          },
          {
            path: '/users/create',
            element: <UserForm />,
          },
          {
            path: '/users/:id/edit',
            element: <UserForm />,
          },
          {
            path: '/users/:id',
            element: <UserDetail />,
          },
          {
            path: '/questions',
            element: <QuestionsList />,
          },
          {
            path: '/questions/create',
            element: <QuestionForm />,
          },
          {
            path: '/questions/:id/edit',
            element: <QuestionForm />,
          },
          {
            path: '/questions/:id',
            element: <QuestionDetail />,
          },
          {
            path: '/questions/bulk-import',
            element: <BulkImport />,
          },
          {
            path: '/templates',
            element: <TemplatesList />,
          },
          {
            path: '/templates/create',
            element: <TemplateForm />,
          },
          {
            path: '/templates/:id',
            element: <TemplateDetail />,
          },
          {
            path: '/templates/:id/edit',
            element: <TemplateForm />,
          },
          {
            path: '/templates/:id/history',
            element: <TemplateHistory />,
          },
          {
            path: '/thresholds',
            element: <ThresholdsList />,
          },
          {
            path: '/thresholds/create',
            element: <ThresholdForm />,
          },
          {
            path: '/thresholds/:id/edit',
            element: <ThresholdForm />,
          },
          {
            path: '/sessions',
            element: <SessionsList />,
          },
          {
            path: '/sessions/create',
            element: <SessionCreate />,
          },
          {
            path: '/sessions/bulk-create',
            element: <BulkSessionCreate />,
          },
          {
            path: '/sessions/view/:accessToken',
            element: <SessionViewByToken />,
          },
          {
            path: '/candidates',
            element: <CandidatesList />,
          },
          {
            path: '/candidates/create',
            element: <CandidateCreate />,
          },
          {
            path: '/candidates/:id/edit',
            element: <CandidateEdit />,
          },
          {
            path: '/candidates/:id',
            element: <CandidateDetail />,
          },
          {
            path: '/manager/dashboard',
            element: <ManagerDashboard />,
          },
          {
            path: '/manager/live',
            element: <LiveMonitoring />,
          },
          {
            path: '/manager/report/:candidateId',
            element: <CandidateReport />,
          },
          {
            path: '/manager/eligible-shortlist',
            element: <EligibleShortlist />,
          },
          {
            path: '/manager/analytics',
            element: <Analytics />,
          },
          {
            path: '/manager/recordings',
            element: <Recordings />,
          },
          {
            path: '/manager/recordings/:sessionId',
            element: <Recordings />,
          },
        ],
      },
    ],
  },
])

export default router