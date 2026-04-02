import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await axios.post(`${backendUrl}/public/forms/${slug}/submit`, req.body);
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Backend error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal server error' });
  }
}
