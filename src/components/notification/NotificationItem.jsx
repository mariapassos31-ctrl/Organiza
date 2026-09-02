import React from 'react'
import { formatDate } from '../../utils/dateUtils'

export const NotificationItem = ({ notification, onRead }) => {
  return (
    <div
      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
        !notification.read ? 'bg-blue-50' : ''
      }`}
      onClick={onRead}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800">{notification.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-400 mt-2">
            {formatDate(notification.createdAt?.toDate?.() || notification.createdAt)}
          </p>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 ml-2"></div>
        )}
      </div>
    </div>
  )
}