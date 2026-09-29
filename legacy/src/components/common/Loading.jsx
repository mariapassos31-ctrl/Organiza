import React from 'react'

export const Loading = ({ fullScreen = false }) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-gray-600 font-medium">Carregando...</p>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return <div className="flex items-center justify-center py-12">{content}</div>
}