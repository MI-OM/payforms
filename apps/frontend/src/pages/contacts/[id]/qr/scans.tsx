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
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  LocationOn as LocationIcon,
  Devices as DeviceIcon,
  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { contactQrCodeService, ScanHistory } from '@/services/contactQrCodeService';
import { formatDate, formatTime } from '@/utils/formatters';

export default function QrCodeScansPage() {
  const router = useRouter();
  const { id: contactId } = router.query;

  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<string>('all');
  const [filteredScans, setFilteredScans] = useState<ScanHistory[]>([]);

  if (!contactId || typeof contactId !== 'string') {
    return <Alert severity="error">Contact ID is required</Alert>;
  }

  useEffect(() => {
    if (contactId) {
      loadScanHistory();
    }
  }, [contactId]);

  useEffect(() => {
    filterScans();
  }, [scanHistory, filterMode]);

  const loadScanHistory = async () => {
    if (typeof contactId !== 'string') return;
    try {
      setLoading(true);
      setError(null);
      const scans = await contactQrCodeService.getScanHistory(contactId);
      setScanHistory(scans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scan history');
    } finally {
      setLoading(false);
    }
  };

  const filterScans = () => {
    if (filterMode === 'all') {
      setFilteredScans(scanHistory);
    } else {
      setFilteredScans(scanHistory.filter((scan) => scan.mode === filterMode));
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleDownloadReport = () => {
    const csv = [
      ['Timestamp', 'Mode', 'IP Address', 'Device', 'User Agent'],
      ...filteredScans.map((scan) => [
        new Date(scan.timestamp).toISOString(),
        scan.mode,
        scan.ipAddress || 'N/A',
        scan.deviceType || 'Unknown',
        scan.userAgent || 'N/A',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-scan-audit-${contactId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getModeColor = (mode: string): 'default' | 'primary' | 'success' | 'warning' | 'info' => {
    switch (mode) {
      case 'public':
        return 'info';
      case 'authenticated':
        return 'primary';
      case 'staff':
        return 'success';
      default:
        return 'default';
    }
  };

  const getModeLabel = (mode: string): string => {
    const labels: Record<string, string> = {
      public: 'Public',
      authenticated: 'Authenticated',
      staff: 'Staff',
    };
    return labels[mode] || mode;
  };

  const getDeviceType = (userAgent: string | undefined): string => {
    if (!userAgent) return 'Unknown';
    if (/mobile|android|iphone/i.test(userAgent)) return 'Mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
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
              <Typography variant="h5" gutterBottom>
                <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                QR Code Scan Audit Trail
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Track all QR code scans for contact {contactId}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadReport}
              disabled={filteredScans.length === 0}
            >
              Export Report
            </Button>
          </Box>
        </Paper>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Total Scans
                </Typography>
                <Typography variant="h6">
                  {scanHistory.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Public Scans
                </Typography>
                <Typography variant="h6">
                  {scanHistory.filter((s) => s.mode === 'public').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Authenticated Scans
                </Typography>
                <Typography variant="h6">
                  {scanHistory.filter((s) => s.mode === 'authenticated').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Staff Scans
                </Typography>
                <Typography variant="h6">
                  {scanHistory.filter((s) => s.mode === 'staff').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FilterIcon fontSize="small" color="action" />
            <TextField
              label="Filter by Mode"
              select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="all">All Modes</MenuItem>
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="authenticated">Authenticated</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
            </TextField>
            <Typography variant="body2" color="textSecondary" sx={{ ml: 'auto' }}>
              Showing {filteredScans.length} of {scanHistory.length} scans
            </Typography>
          </Box>
        </Paper>

        {/* Scan History Table */}
        {filteredScans.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredScans.map((scan, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {formatDate(new Date(scan.timestamp))}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {formatTime(new Date(scan.timestamp))}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getModeLabel(scan.mode)}
                        color={getModeColor(scan.mode)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DeviceIcon fontSize="small" />
                        <Typography variant="body2">
                          {getDeviceType(scan.userAgent)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          bgcolor: '#f5f5f5',
                          p: 0.5,
                          borderRadius: 0.5,
                          display: 'inline-block',
                        }}
                      >
                        {scan.ipAddress || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="textSecondary">
                        {scan.location
                          ? `${scan.location.city}, ${scan.location.country}`
                          : 'Unknown location'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <ScheduleIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
              <Typography variant="body2" color="textSecondary">
                {scanHistory.length === 0
                  ? 'No scans recorded yet'
                  : 'No scans match the selected filter'}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Information Notice */}
        <Paper sx={{ p: 2, mt: 3, bgcolor: '#f5f5f5' }}>
          <Typography variant="caption" display="block" color="textSecondary" gutterBottom>
            ℹ️ Scan Audit Information
          </Typography>
          <Typography variant="caption" color="textSecondary">
            This page logs all QR code scans for security and audit purposes. Each scan includes
            the timestamp, access mode, device information, and IP address. This data is retained
            for 90 days and is used to detect suspicious activity.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
