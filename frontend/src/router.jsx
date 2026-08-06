import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Landing from './pages/Landing'
import LoadingSpinner from './components/ui/LoadingSpinner'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const UsersList = lazy(() => import('./pages/Users/List'))
const UserForm = lazy(() => import('./pages/Users/Form'))
const UserDetail = lazy(() => import('./pages/Users/Detail'))
const QuestionsList = lazy(() => import('./pages/Questions/List'))
const QuestionForm = lazy(() => import('./pages/Questions/Form'))
const QuestionDetail = lazy(() => import('./pages/Questions/Detail'))
const BulkImport = lazy(() => import('./pages/Questions/BulkImport'))
const TemplatesList = lazy(() => import('./pages/Templates/List'))
const TemplateForm = lazy(() => import('./pages/Templates/Form'))
const TemplateDetail = lazy(() => import('./pages/Templates/Detail'))
const TemplateHistory = lazy(() => import('./pages/Templates/History'))
const ThresholdsList = lazy(() => import('./pages/Thresholds/List'))
const ThresholdForm = lazy(() => import('./pages/Thresholds/Form'))
const SessionsList = lazy(() => import('./pages/Sessions/List'))
const SessionCreate = lazy(() => import('./pages/Sessions/Create'))
const SessionViewByToken = lazy(() => import('./pages/Sessions/ViewBytoken'))
const BulkSessionCreate = lazy(() => import('./pages/Sessions/BulkCreate'))
const CandidatesList = lazy(() => import('./pages/Candidates/List'))
const CandidateCreate = lazy(() => import('./pages/Candidates/Create'))
const CandidateEdit = lazy(() => import('./pages/Candidates/Edit'))
const CandidateDetail = lazy(() => import('./pages/Candidates/Detail'))
const AssessmentVerify = lazy(() => import('./pages/Assessment/Verify'))
const AssessmentTake = lazy(() => import('./pages/Assessment/Take'))
const AssessmentSubmit = lazy(() => import('./pages/Assessment/Submit'))
const AssessmentThankYou = lazy(() => import('./pages/Assessment/Thankyou'))
const ManagerDashboard = lazy(() => import('./pages/Manager/Dashboard'))
const LiveMonitoring = lazy(() => import('./pages/Manager/LiveMonitoring'))
const CandidateReport = lazy(() => import('./pages/Manager/CandidateReport'))
const EligibleShortlist = lazy(() => import('./pages/Manager/EligibleShortlist'))
const SessionReport = lazy(() => import('./pages/Manager/SessionReport'))
const Analytics = lazy(() => import('./pages/Manager/Analytics'))
const Recordings = lazy(() => import('./pages/Manager/Recordings'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

const withSuspense = (Component) => (
  <Suspense fallback={<LoadingSpinner />}>
    {Component}
  </Suspense>
)

const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/forgot-password',
    element: withSuspense(<ForgotPassword />),
  },
  {
    path: '/reset-password',
    element: withSuspense(<ResetPassword />),
  },
  {
    path: '/assessment/:accessToken',
    element: withSuspense(<AssessmentVerify />),
  },
  {
    path: '/assessment/:accessToken/take',
    element: withSuspense(<AssessmentTake />),
  },
  {
    path: '/assessment/:accessToken/submit',
    element: withSuspense(<AssessmentSubmit />),
  },
  {
    path: '/assessment/:accessToken/thankyou',
    element: withSuspense(<AssessmentThankYou />),
  },
  {
    path: '/dashboard',
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: '/users',
    element: <Navigate to="/app/users" replace />,
  },
  {
    path: '/users/create',
    element: <Navigate to="/app/users/create" replace />,
  },
  {
    path: '/users/:id',
    element: <Navigate to="/app/users/:id" replace />,
  },
  {
    path: '/users/:id/edit',
    element: <Navigate to="/app/users/:id/edit" replace />,
  },
  {
    path: '/questions',
    element: <Navigate to="/app/questions" replace />,
  },
  {
    path: '/questions/create',
    element: <Navigate to="/app/questions/create" replace />,
  },
  {
    path: '/questions/:id',
    element: <Navigate to="/app/questions/:id" replace />,
  },
  {
    path: '/questions/:id/edit',
    element: <Navigate to="/app/questions/:id/edit" replace />,
  },
  {
    path: '/questions/bulk-import',
    element: <Navigate to="/app/questions/bulk-import" replace />,
  },
  {
    path: '/templates',
    element: <Navigate to="/app/templates" replace />,
  },
  {
    path: '/templates/create',
    element: <Navigate to="/app/templates/create" replace />,
  },
  {
    path: '/templates/:id',
    element: <Navigate to="/app/templates/:id" replace />,
  },
  {
    path: '/templates/:id/edit',
    element: <Navigate to="/app/templates/:id/edit" replace />,
  },
  {
    path: '/templates/:id/history',
    element: <Navigate to="/app/templates/:id/history" replace />,
  },
  {
    path: '/thresholds',
    element: <Navigate to="/app/thresholds" replace />,
  },
  {
    path: '/thresholds/create',
    element: <Navigate to="/app/thresholds/create" replace />,
  },
  {
    path: '/thresholds/:id/edit',
    element: <Navigate to="/app/thresholds/:id/edit" replace />,
  },
  {
    path: '/sessions',
    element: <Navigate to="/app/sessions" replace />,
  },
  {
    path: '/sessions/create',
    element: <Navigate to="/app/sessions/create" replace />,
  },
  {
    path: '/sessions/bulk-create',
    element: <Navigate to="/app/sessions/bulk-create" replace />,
  },
  {
    path: '/sessions/view/:accessToken',
    element: <Navigate to="/app/sessions/view/:accessToken" replace />,
  },
  {
    path: '/candidates',
    element: <Navigate to="/app/candidates" replace />,
  },
  {
    path: '/candidates/create',
    element: <Navigate to="/app/candidates/create" replace />,
  },
  {
    path: '/candidates/:id',
    element: <Navigate to="/app/candidates/:id" replace />,
  },
  {
    path: '/candidates/:id/edit',
    element: <Navigate to="/app/candidates/:id/edit" replace />,
  },
  {
    path: '/manager/dashboard',
    element: <Navigate to="/app/manager/dashboard" replace />,
  },
  {
    path: '/manager/live',
    element: <Navigate to="/app/manager/live" replace />,
  },
  {
    path: '/manager/report/:candidateId',
    element: <Navigate to="/app/manager/report/:candidateId" replace />,
  },
  {
    path: '/manager/eligible-shortlist',
    element: <Navigate to="/app/manager/eligible-shortlist" replace />,
  },
  {
    path: '/manager/session-report/:sessionId',
    element: <Navigate to="/app/manager/session-report/:sessionId" replace />,
  },
  {
    path: '/manager/analytics',
    element: <Navigate to="/app/manager/analytics" replace />,
  },
  {
    path: '/manager/recordings',
    element: <Navigate to="/app/manager/recordings" replace />,
  },
  {
    path: '/manager/recordings/:sessionId',
    element: <Navigate to="/app/manager/recordings/:sessionId" replace />,
  },
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/app/dashboard" replace />,
          },
          {
            path: '/app/dashboard',
            element: withSuspense(<Dashboard />),
          },
          {
            path: '/app/users',
            element: withSuspense(<UsersList />),
          },
          {
            path: '/app/users/create',
            element: withSuspense(<UserForm />),
          },
          {
            path: '/app/users/:id/edit',
            element: withSuspense(<UserForm />),
          },
          {
            path: '/app/users/:id',
            element: withSuspense(<UserDetail />),
          },
          {
            path: '/app/questions',
            element: withSuspense(<QuestionsList />),
          },
          {
            path: '/app/questions/create',
            element: withSuspense(<QuestionForm />),
          },
          {
            path: '/app/questions/:id/edit',
            element: withSuspense(<QuestionForm />),
          },
          {
            path: '/app/questions/:id',
            element: withSuspense(<QuestionDetail />),
          },
          {
            path: '/app/questions/bulk-import',
            element: withSuspense(<BulkImport />),
          },
          {
            path: '/app/templates',
            element: withSuspense(<TemplatesList />),
          },
          {
            path: '/app/templates/create',
            element: withSuspense(<TemplateForm />),
          },
          {
            path: '/app/templates/:id',
            element: withSuspense(<TemplateDetail />),
          },
          {
            path: '/app/templates/:id/edit',
            element: withSuspense(<TemplateForm />),
          },
          {
            path: '/app/templates/:id/history',
            element: withSuspense(<TemplateHistory />),
          },
          {
            path: '/app/thresholds',
            element: withSuspense(<ThresholdsList />),
          },
          {
            path: '/app/thresholds/create',
            element: withSuspense(<ThresholdForm />),
          },
          {
            path: '/app/thresholds/:id/edit',
            element: withSuspense(<ThresholdForm />),
          },
          {
            path: '/app/sessions',
            element: withSuspense(<SessionsList />),
          },
          {
            path: '/app/sessions/create',
            element: withSuspense(<SessionCreate />),
          },
          {
            path: '/app/sessions/bulk-create',
            element: withSuspense(<BulkSessionCreate />),
          },
          {
            path: '/app/sessions/view/:accessToken',
            element: withSuspense(<SessionViewByToken />),
          },
          {
            path: '/app/candidates',
            element: withSuspense(<CandidatesList />),
          },
          {
            path: '/app/candidates/create',
            element: withSuspense(<CandidateCreate />),
          },
          {
            path: '/app/candidates/:id/edit',
            element: withSuspense(<CandidateEdit />),
          },
          {
            path: '/app/candidates/:id',
            element: withSuspense(<CandidateDetail />),
          },
          {
            path: '/app/manager/dashboard',
            element: withSuspense(<ManagerDashboard />),
          },
          {
            path: '/app/manager/live',
            element: withSuspense(<LiveMonitoring />),
          },
          {
            path: '/app/manager/report/:candidateId',
            element: withSuspense(<CandidateReport />),
          },
          {
            path: '/app/manager/eligible-shortlist',
            element: withSuspense(<EligibleShortlist />),
          },
          {
            path: '/app/manager/session-report/:sessionId',
            element: withSuspense(<SessionReport />),
          },
          {
            path: '/app/manager/analytics',
            element: withSuspense(<Analytics />),
          },
          {
            path: '/app/manager/recordings',
            element: withSuspense(<Recordings />),
          },
          {
            path: '/app/manager/recordings/:sessionId',
            element: withSuspense(<Recordings />),
          },
        ],
      },
    ],
  },
], {
  future: {
    v7_startTransition: true,
  },
})

export default router