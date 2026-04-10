import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PaymentSuccess() {
  const router = useRouter();
  const { reference, status, error, message: queryMessage } = router.query;
  const [message, setMessage] = useState('Thank you for your payment. Your transaction has been processed successfully.');
  const [isSuccess, setIsSuccess] = useState(true);

  useEffect(() => {
    if (error) {
      setIsSuccess(false);
      switch (error) {
        case 'payment_not_found':
          setMessage('Payment not found. Please contact support if you were charged.');
          break;
        case 'verification_failed':
          setMessage('Payment verification failed. Please contact support.');
          break;
        case 'no_reference':
          setMessage('Invalid payment reference. Please contact support.');
          break;
        default:
          setMessage('An error occurred during payment processing. Please contact support.');
      }
    } else if (status === 'failed') {
      setIsSuccess(false);
      setMessage('Payment was not successful. Please try again or contact support.');
    } else if (status === 'pending') {
      setIsSuccess(true);
      setMessage(
        typeof queryMessage === 'string' && queryMessage.trim()
          ? queryMessage
          : 'Your payment has been recorded and is awaiting admin confirmation.',
      );
    }
  }, [error, status, queryMessage]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
            {isSuccess ? (
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          <h1 className={`text-2xl font-bold mb-4 ${isSuccess ? 'text-gray-900' : 'text-red-900'}`}>
            {isSuccess ? (status === 'pending' ? 'Payment Pending Confirmation' : 'Payment Successful!') : 'Payment Failed'}
          </h1>

          <p className="text-gray-600 mb-6">
            {message}
          </p>

          {reference && (
            <p className="text-sm text-gray-500 mb-6">
              Reference: {reference}
            </p>
          )}

          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </Link>

            <button
              onClick={() => router.back()}
              className="block w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
