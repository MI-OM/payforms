'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import {
  Container,
  Paper,
  Box,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  QrCode as QrCodeIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { contactQrCodeService } from '@/services/contactQrCodeService';
import { QrCode as QrCodeType } from '@/services/contactQrCodeService';

export default function ContactQrCodePage() {
  const router = useRouter();
  const { id: contactId } = router.query;
  const qrRef = useRef<HTMLDivElement>(null);

  const [qrCode, setQrCode] = useState<QrCodeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!contactId || typeof contactId !== 'string') {
    return <Alert severity="error">Contact ID is required</Alert>;
  }

  useEffect(() => {
    if (contactId) {
      loadQrCode();
    }
  }, [contactId]);

  const loadQrCode = async () => {
    if (typeof contactId !== 'string') return;
    try {
      setLoading(true);
      setError(null);
      const qr = await contactQrCodeService.getQrCodeStatus(contactId);
      setQrCode(qr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQrCode = async () => {
    if (typeof contactId !== 'string') return;
    try {
      setLoading(true);
      setError(null);
      const qr = await contactQrCodeService.generateQrCode(contactId);
      setQrCode(qr);
      setSuccessMessage('QR code generated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQrCode = async () => {
    if (typeof contactId !== 'string') return;
    try {
      const blob = await contactQrCodeService.downloadQrCode(contactId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-code-${contactId}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download QR code');
    }
  };

  const handleRegenerateQrCode = async () => {
    if (typeof contactId !== 'string') return;
    try {
      setRegenerating(true);
      setError(null);
      const qr = await contactQrCodeService.regenerateQrCode(contactId);
      setQrCode(qr);
      setShowRegenerateDialog(false);
      setSuccessMessage('QR code regenerated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate QR code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleViewScanHistory = () => {
    router.push(`/contacts/${contactId}/qr/scans`);
  };

  const getQrUrl = (): string => {
    if (!qrCode) return '';
    return `${window.location.origin}/qr/${qrCode.token}`;
  };

  if (loading && !qrCode) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCodeIcon /> QR Code Payment
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Generate and manage QR codes for contact payment scanning
          </Typography>
        </Box>

        {/* Messages */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

        {/* QR Code Section */}
        {qrCode ? (
          <Grid container spacing={3}>
            {/* QR Code Display */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Your Payment QR Code
                </Typography>
                <Box
                  ref={qrRef}
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 1,
                    mb: 2,
                  }}
                >
                  <QRCode
                    value={getQrUrl()}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </Box>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
                  Token: {qrCode.token.substring(0, 20)}...
                </Typography>
              </Paper>
            </Grid>

            {/* QR Code Info */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    QR Code Information
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Status
                    </Typography>
                    <Chip
                      label={qrCode.isActive ? 'Active' : 'Inactive'}
                      color={qrCode.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {new Date(qrCode.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Last Used
                    </Typography>
                    <Typography variant="body2">
                      {qrCode.lastUsedAt
                        ? new Date(qrCode.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" color="textSecondary">
                      Scan Count
                    </Typography>
                    <Typography variant="body2">
                      {qrCode.scanCount || 0} scans
                    </Typography>
                  </Box>

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={handleDownloadQrCode}
                    >
                      Download QR Code
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<HistoryIcon />}
                      onClick={handleViewScanHistory}
                    >
                      View Scan History
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="warning"
                      startIcon={<RefreshIcon />}
                      onClick={() => setShowRegenerateDialog(true)}
                    >
                      Regenerate QR Code
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Access Modes */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Access Modes
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    This QR code can be scanned in different contexts:
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <Paper sx={{ p: 2, bgcolor: '#e3f2fd' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          📱 Public Mode
                        </Typography>
                        <Typography variant="caption">
                          View basic payment summary without authentication
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Paper sx={{ p: 2, bgcolor: '#f3e5f5' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          🔐 Authenticated Mode
                        </Typography>
                        <Typography variant="caption">
                          View detailed payment information after contact login
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Paper sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          👨‍💼 Staff Mode
                        </Typography>
                        <Typography variant="caption">
                          View comprehensive payment details with staff authentication
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" gutterBottom>
              No QR code generated yet
            </Typography>
            <Button
              variant="contained"
              startIcon={<QrCodeIcon />}
              onClick={handleGenerateQrCode}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </Button>
          </Paper>
        )}

        {/* Regenerate Confirmation Dialog */}
        <Dialog open={showRegenerateDialog} onClose={() => setShowRegenerateDialog(false)}>
          <DialogTitle>Regenerate QR Code?</DialogTitle>
          <DialogContent>
            <Typography>
              This will create a new QR code token. The old QR code will no longer work. This action is permanent.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowRegenerateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleRegenerateQrCode}
              variant="contained"
              color="warning"
              disabled={regenerating}
            >
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
}
