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
  Tabs,
  Tab,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  School as SchoolIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { contactQrCodeService, PaymentDetails, Payment } from '@/services/contactQrCodeService';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function StaffQrPaymentPage() {
  const router = useRouter();
  const { token } = router.query;

  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCategory, setPaymentCategory] = useState('');

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
        scanMode: 'staff',
        userAgent: navigator.userAgent,
        timestamp: new Date(),
      });
      // Get the staff details
      const data = await contactQrCodeService.getStaffDetails(token);
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRecordPayment = async () => {
    try {
      // Implementation would call a service to record the payment
      // await paymentService.recordPayment({
      //   contactId: token,
      //   amount: parseFloat(paymentAmount),
      //   category: paymentCategory,
      // });
      setShowRecordPayment(false);
      setPaymentAmount('');
      setPaymentCategory('');
      // Reload the details
      await loadPaymentDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    }
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
        <Paper sx={{ p: 3, mb: 3, bgcolor: '#f5f5f5' }}>
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
            <Box sx={{ textAlign: 'right' }}>
              <Chip
                label={details.balanceDue === 0 ? 'All Paid' : 'Outstanding'}
                color={details.balanceDue === 0 ? 'success' : 'error'}
                variant="outlined"
              />
              <Typography variant="caption" display="block" color="textSecondary" sx={{ mt: 1 }}>
                Staff View
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#e3f2fd' }}>
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
            <Card sx={{ bgcolor: '#e8f5e9' }}>
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
            <Card sx={{ bgcolor: '#ffebee' }}>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Balance Due
                </Typography>
                <Typography variant="h6" color="error.main">
                  {formatCurrency(details.balanceDue)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#fff3e0' }}>
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

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Payment Breakdown" />
            <Tab label="Payment History" />
            <Tab label="Staff Actions" />
          </Tabs>

          {/* Tab 1: Payment Breakdown */}
          <TabPanel value={tabValue} index={0}>
            <CardContent>
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
          </TabPanel>

          {/* Tab 2: Payment History */}
          <TabPanel value={tabValue} index={1}>
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
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.payments.map((payment, idx) => (
                      <TableRow key={idx} hover>
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
                        <TableCell>
                          <Button size="small" startIcon={<VisibilityIcon />}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  No payments recorded yet
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Tab 3: Staff Actions */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
              <Alert severity="info">
                Use these actions to manage student payments as staff.
              </Alert>

              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowRecordPayment(true)}
              >
                Record Manual Payment
              </Button>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<EditIcon />}
              >
                Adjust Balance
              </Button>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<DownloadIcon />}
              >
                Export Payment Report
              </Button>
            </Box>
          </TabPanel>
        </Paper>

        {/* Record Payment Dialog */}
        <Dialog open={showRecordPayment} onClose={() => setShowRecordPayment(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Record Manual Payment</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              inputProps={{ step: '0.01', min: '0' }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Category"
              select
              value={paymentCategory}
              onChange={(e) => setPaymentCategory(e.target.value)}
              SelectProps={{
                native: true,
              }}
            >
              <option value="">Select a category</option>
              {details.breakdown?.map((item) => (
                <option key={item.category} value={item.category}>
                  {item.category}
                </option>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowRecordPayment(false)}>Cancel</Button>
            <Button
              onClick={handleRecordPayment}
              variant="contained"
              disabled={!paymentAmount || !paymentCategory}
            >
              Record Payment
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
}
