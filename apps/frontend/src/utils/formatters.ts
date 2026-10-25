/**
 * Currency formatter - formats numbers as USD currency
 * @param amount - The amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Date formatter - formats dates as MM/DD/YYYY
 * @param date - The date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date | undefined | null): string => {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Time formatter - formats times as HH:MM AM/PM
 * @param date - The date/time to format
 * @returns Formatted time string
 */
export const formatTime = (date: Date | undefined | null): string => {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * DateTime formatter - formats as "MM/DD/YYYY HH:MM AM/PM"
 * @param date - The date/time to format
 * @returns Formatted date/time string
 */
export const formatDateTime = (date: Date | undefined | null): string => {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * Percentage formatter - formats numbers as percentages
 * @param value - The value to format (0-100)
 * @param decimals - Number of decimal places (default 0)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number | undefined | null, decimals: number = 0): string => {
  if (value === undefined || value === null) {
    return '0%';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

/**
 * Phone number formatter - formats phone numbers with standard US format
 * @param phone - The phone number to format
 * @returns Formatted phone string (e.g., (123) 456-7890)
 */
export const formatPhoneNumber = (phone: string | undefined | null): string => {
  if (!phone) {
    return 'N/A';
  }

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }

  return phone;
};

/**
 * Email validator - basic email validation
 * @param email - The email to validate
 * @returns Boolean indicating if email is valid
 */
export const isValidEmail = (email: string | undefined | null): boolean => {
  if (!email) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Truncate text - truncate text with ellipsis
 * @param text - The text to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to append (default "...")
 * @returns Truncated text
 */
export const truncateText = (text: string | undefined | null, length: number, suffix: string = '...'): string => {
  if (!text) {
    return '';
  }

  if (text.length <= length) {
    return text;
  }

  return text.substring(0, length) + suffix;
};

/**
 * Format file size - converts bytes to human readable format
 * @param bytes - The number of bytes
 * @returns Human readable file size
 */
export const formatFileSize = (bytes: number | undefined | null): string => {
  if (bytes === undefined || bytes === null) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Days since formatter - calculates days since a date
 * @param date - The date to compare
 * @returns Number of days since the date
 */
export const daysSince = (date: Date | undefined | null): number => {
  if (!date || !(date instanceof Date)) {
    return 0;
  }

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

/**
 * Relative time formatter - formats time relative to now (e.g., "2 hours ago")
 * @param date - The date to format
 * @returns Relative time string
 */
export const formatRelativeTime = (date: Date | undefined | null): string => {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  } else {
    return formatDate(date);
  }
};
