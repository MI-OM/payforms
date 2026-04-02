import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-4">Payforms</h1>
        <p className="text-xl text-blue-100 mb-8">Multi-tenant Payment Collection Platform</p>
        <div className="space-x-4">
          <a
            href="/login"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition"
          >
            Admin Login
          </a>
          <a
            href="/contact/login"
            className="inline-block bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
          >
            Contact Portal
          </a>
        </div>
      </div>
    </div>
  );
}
