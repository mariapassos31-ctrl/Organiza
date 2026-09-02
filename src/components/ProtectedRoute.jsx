import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, requiredRoles, userData }) {
  if (!userData) {
    return <Navigate to="/login" />
  }

  // Se requiredRoles é um array, verifica se o role do usuário está nele
  if (Array.isArray(requiredRoles)) {
    if (!requiredRoles.includes(userData.role)) {
      return <Navigate to="/dashboard" />
    }
  }

  return children
}