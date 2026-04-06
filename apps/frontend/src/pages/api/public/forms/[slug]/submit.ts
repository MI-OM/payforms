import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;
  const { callback_url } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const submitUrl = `${backendUrl}/public/forms/${slug}/submit`;

    // Forward the callback_url as a query parameter to the backend
    const url = new URL(submitUrl);
    if (callback_url) {
      url.searchParams.set('callback_url', callback_url as string);
    }

    const response = await axios.post(url.toString(), req.body);
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Backend error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal server error' });
  }
}
