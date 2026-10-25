'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Container,
  Paper,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  School as SchoolIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { contactQrCodeService, PaymentSummary } from '@/services/contactQrCodeService';
import { formatCurrency } from '@/utils/formatters';

export default function PublicQrPaymentPage() {
  const router = useRouter();
  const { token } = router.query;

  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!token || typeof token !== 'string') {
    return <Alert severity="error">Payment token is required</Alert>;
  }

  useEffect(() => {
    if (token) {
      loadPaymentSummary();
    }
  }, [token]);

  const loadPaymentSummary = async () => {
    if (typeof token !== 'string') return;
    try {
      setLoading(true);
      setError(null);
      // Record the scan
      await contactQrCodeService.recordScan(token, {
        scanMode: 'public',
        userAgent: navigator.userAgent,
        timestamp: new Date(),
      });
      // Get the summary
      const data = await contactQrCodeService.getPublicSummary(token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Box sx={{ py: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  if (!summary) {
    return (
      <Container>
        <Box sx={{ py: 4 }}>
          <Alert severity="warning">No payment information available</Alert>
        </Box>
      </Container>
    );
  }

  const balancePercentage = summary.totalAmount > 0
    ? Math.round((summary.balanceDue / summary.totalAmount) * 100)
    : 0;

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <SchoolIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          </Box>
          <Typography variant="h5" gutterBottom>
            {summary.studentName}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {summary.schoolName}
          </Typography>
        </Paper>

        {/* Balance Status */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Balance Due
            </Typography>
            <Typography variant="h4" color={summary.balanceDue > 0 ? 'error' : 'success'} gutterBottom>
              {formatCurrency(summary.balanceDue)}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary" display="block">
                  Total Amount
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(summary.totalAmount)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary" display="block">
                  Paid Amount
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(summary.paidAmount)}
                </Typography>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption">Payment Progress</Typography>
                <Typography variant="caption" color="textSecondary">
                  {100 - balancePercentage}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={100 - balancePercentage}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Payment Breakdown
            </Typography>
            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
              {summary.breakdown && summary.breakdown.map((item, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2">{item.category}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {item.description}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color={item.balanceDue > 0 ? 'error' : 'success'}>
                      {formatCurrency(item.balanceDue)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      of {formatCurrency(item.amount)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Payment Status
            </Typography>
            <Divider sx={{ my: 1 }} />

            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PaymentIcon
                sx={{
                  color: summary.balanceDue === 0 ? 'success.main' : 'warning.main',
                }}
              />
              <Typography variant="body2">
                {summary.balanceDue === 0
                  ? '✓ All payments are current'
                  : `⚠ ${formatCurrency(summary.balanceDue)} outstanding`}
              </Typography>
            </Box>

            {summary.daysOverdue > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Payment is {summary.daysOverdue} day{summary.daysOverdue !== 1 ? 's' : ''} overdue
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Action Button */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<PaymentIcon />}
          sx={{ mb: 2 }}
        >
          Make a Payment
        </Button>

        {/* Information Notice */}
        <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Typography variant="caption" color="textSecondary" display="block">
            ℹ️ This is a summary view. For detailed payment history and options, please log in
            with your contact credentials or contact your school administration.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
