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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  School as SchoolIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { contactQrCodeService, PaymentDetails, Payment } from '@/services/contactQrCodeService';
import { formatCurrency, formatDate } from '@/utils/formatters';

export default function AuthenticatedQrPaymentPage() {
  const router = useRouter();
  const { token } = router.query;

  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  if (!token || typeof token !== 'string') {
    return <Alert severity="error">Payment token is required</Alert>;
  }

  useEffect(() => {
    if (token) {
      loadPaymentDetails();
    }
  }, [token]);

  const loadPaymentDetails = async () => {
    if (typeof token !== 'string') return;
    try {
      setLoading(true);
      setError(null);
      // Record the scan
      await contactQrCodeService.recordScan(token, {
        scanMode: 'authenticated',
        userAgent: navigator.userAgent,
        timestamp: new Date(),
      });
      // Get the details
      const data = await contactQrCodeService.getAuthenticatedDetails(token);
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      case 'partial':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      paid: 'Paid',
      pending: 'Pending',
      overdue: 'Overdue',
      partial: 'Partial',
    };
    return labels[status] || status;
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
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleGoBack}
            sx={{ mb: 2 }}
          >
            Back
          </Button>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  if (!details) {
    return (
      <Container>
        <Box sx={{ py: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleGoBack}
            sx={{ mb: 2 }}
          >
            Back
          </Button>
          <Alert severity="warning">No payment details available</Alert>
        </Box>
      </Container>
    );
  }

  const balancePercentage = details.totalAmount > 0
    ? Math.round((details.balanceDue / details.totalAmount) * 100)
    : 0;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleGoBack}
          sx={{ mb: 2 }}
        >
          Back
        </Button>

        {/* Header */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SchoolIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                <Typography variant="h5">
                  {details.studentName}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                {details.schoolName}
              </Typography>
            </Box>
            <Chip
              label={details.balanceDue === 0 ? 'All Paid' : 'Outstanding'}
              color={details.balanceDue === 0 ? 'success' : 'error'}
              variant="outlined"
            />
          </Box>
        </Paper>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Total Amount
                </Typography>
                <Typography variant="h6">
                  {formatCurrency(details.totalAmount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Paid Amount
                </Typography>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(details.paidAmount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Balance Due
                </Typography>
                <Typography
                  variant="h6"
                  color={details.balanceDue > 0 ? 'error.main' : 'success.main'}
                >
                  {formatCurrency(details.balanceDue)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Days Overdue
                </Typography>
                <Typography variant="h6" color={details.daysOverdue > 0 ? 'warning.main' : 'success.main'}>
                  {details.daysOverdue}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Progress Bar */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Payment Progress</Typography>
              <Typography variant="caption" color="textSecondary">
                {100 - balancePercentage}% Paid
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={100 - balancePercentage}
              sx={{ height: 12, borderRadius: 1 }}
            />
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Breakdown
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {details.breakdown && details.breakdown.map((item, idx) => (
                <Box key={idx}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {item.category}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {item.description}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(item.balanceDue)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        of {formatCurrency(item.amount)}
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={item.amount > 0 ? ((item.amount - item.balanceDue) / item.amount) * 100 : 0}
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                  {idx < details.breakdown!.length - 1 && <Divider sx={{ my: 1 }} />}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment History
            </Typography>
            <Divider sx={{ my: 2 }} />

            {details.payments && details.payments.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Reference</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.payments.map((payment, idx) => (
                      <TableRow
                        key={idx}
                        onClick={() => setSelectedPayment(payment)}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f9f9f9' } }}
                      >
                        <TableCell>
                          {formatDate(new Date(payment.date))}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          {payment.category}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(payment.status)}
                            color={getStatusColor(payment.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {payment.referenceId?.substring(0, 12)}...
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No payments recorded yet
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<PaymentIcon />}
            >
              Make a Payment
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              startIcon={<DownloadIcon />}
            >
              Download Statement
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
