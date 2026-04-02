import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { reference } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ message: 'Payment reference is required' });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await axios.get(`${backendUrl}/public/payments/verify?reference=${reference}`);
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Backend error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal server error' });
  }
}
