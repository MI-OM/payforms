# Integration Tests for Features 1 & 4
# Feature 1: Contact Import Templates
# Feature 4: API Integration Webhooks
#
# This script tests all CRUD operations and integration scenarios

param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$Email = "test@example.com",
  [string]$Password = "Test@1234"
)

# Helper function for making API calls
function Invoke-ApiCall {
  param(
    [string]$Method,
    [string]$Endpoint,
    [object]$Body,
    [string]$Token
  )

  $url = "$BaseUrl$Endpoint"
  $headers = @{
    "Content-Type" = "application/json"
  }

  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  try {
    $response = Invoke-WebRequest `
      -Uri $url `
      -Method $Method `
      -Headers $headers `
      -Body ($Body | ConvertTo-Json -Depth 10) `
      -UseBasicParsing `
      -ErrorAction Stop

    return @{
      Success = $true
      Status = $response.StatusCode
      Body = $response.Content | ConvertFrom-Json
    }
  }
  catch {
    $status = $_.Exception.Response.StatusCode.Value
    $content = $_.Exception.Response.Content.ReadAsStream()
    $reader = New-Object System.IO.StreamReader($content)
    $body = $reader.ReadToEnd()
    
    return @{
      Success = $false
      Status = $status
      Body = if ($body) { $body | ConvertFrom-Json -ErrorAction SilentlyContinue } else { $null }
      Error = $_.Exception.Message
    }
  }
}

# Test Results
$results = @{
  Passed = 0
  Failed = 0
  Tests = @()
}

function Assert-Response {
  param(
    [string]$TestName,
    [int]$ExpectedStatus,
    [object]$Response
  )

  if ($Response.Status -eq $ExpectedStatus) {
    Write-Host "✓ PASS: $TestName (Status: $($Response.Status))" -ForegroundColor Green
    $results.Passed++
  }
  else {
    Write-Host "✗ FAIL: $TestName (Expected: $ExpectedStatus, Got: $($Response.Status))" -ForegroundColor Red
    $results.Failed++
    if ($Response.Body.message) {
      Write-Host "  Error: $($Response.Body.message)" -ForegroundColor Red
    }
  }
  
  $results.Tests += @{
    Name = $TestName
    Expected = $ExpectedStatus
    Actual = $Response.Status
    Passed = $Response.Status -eq $ExpectedStatus
  }
}

Write-Host "=== Feature 1 & 4 Integration Tests ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "Step 1: Authentication" -ForegroundColor Yellow
$loginResponse = Invoke-ApiCall -Method "POST" -Endpoint "/auth/login" -Body @{
  email = $Email
  password = $Password
}

Assert-Response "Login successful" 200 $loginResponse
if (-not $loginResponse.Success) {
  Write-Host "Cannot proceed without authentication" -ForegroundColor Red
  exit 1
}

$token = $loginResponse.Body.access_token
Write-Host "  Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

# Feature 1: Contact Import Templates
Write-Host "Step 2: Contact Import Templates (Feature 1)" -ForegroundColor Yellow
Write-Host ""

# Create template
Write-Host "2.1 Create Import Template" -ForegroundColor Cyan
$createTemplateResponse = Invoke-ApiCall -Method "POST" -Endpoint "/contacts/import-templates" -Token $token -Body @{
  name = "Test Import Template"
  description = "Template for testing"
  fields = @(
    @{
      column_name = "First Name"
      field_type = "text"
      field_name = "first_name"
      required = $true
    },
    @{
      column_name = "Email"
      field_type = "email"
      field_name = "email"
      required = $true
    },
    @{
      column_name = "Phone"
      field_type = "phone"
      field_name = "phone"
      required = $false
    }
  )
}

Assert-Response "Create import template" 201 $createTemplateResponse
$templateId = $createTemplateResponse.Body.id
Write-Host "  Template ID: $templateId" -ForegroundColor Gray
Write-Host ""

# List templates
Write-Host "2.2 List Import Templates" -ForegroundColor Cyan
$listTemplatesResponse = Invoke-ApiCall -Method "GET" -Endpoint "/contacts/import-templates" -Token $token
Assert-Response "List import templates" 200 $listTemplatesResponse
Write-Host "  Found $($listTemplatesResponse.Body.Count) templates" -ForegroundColor Gray
Write-Host ""

# Get specific template
Write-Host "2.3 Get Specific Import Template" -ForegroundColor Cyan
$getTemplateResponse = Invoke-ApiCall -Method "GET" -Endpoint "/contacts/import-templates/$templateId" -Token $token
Assert-Response "Get import template" 200 $getTemplateResponse
Write-Host "  Template fields: $($getTemplateResponse.Body.fields.Count)" -ForegroundColor Gray
Write-Host ""

# Update template
Write-Host "2.4 Update Import Template" -ForegroundColor Cyan
$updateTemplateResponse = Invoke-ApiCall -Method "PATCH" -Endpoint "/contacts/import-templates/$templateId" -Token $token -Body @{
  name = "Updated Template Name"
  description = "Updated description"
}

Assert-Response "Update import template" 200 $updateTemplateResponse
Write-Host "  Updated name: $($updateTemplateResponse.Body.name)" -ForegroundColor Gray
Write-Host ""

# Set as default
Write-Host "2.5 Set Template as Default" -ForegroundColor Cyan
$setDefaultResponse = Invoke-ApiCall -Method "POST" -Endpoint "/contacts/import-templates/$templateId/set-default" -Token $token
Assert-Response "Set template as default" 200 $setDefaultResponse
Write-Host "  Is default: $($setDefaultResponse.Body.is_default)" -ForegroundColor Gray
Write-Host ""

# Feature 4: API Integration Webhooks
Write-Host "Step 3: API Integration Webhooks (Feature 4)" -ForegroundColor Yellow
Write-Host ""

# Create webhook
Write-Host "3.1 Create Webhook Endpoint" -ForegroundColor Cyan
$createWebhookResponse = Invoke-ApiCall -Method "POST" -Endpoint "/v1/market/integrations/endpoints" -Token $token -Body @{
  name = "Test Webhook"
  description = "Webhook for testing"
  url = "https://example.com/webhook"
  auth_type = "API_KEY"
  auth_config = @{
    api_key = "test-api-key-123"
    header_name = "X-API-Key"
  }
  events = @(
    "contact.created",
    "payment.completed"
  )
}

Assert-Response "Create webhook endpoint" 201 $createWebhookResponse
$webhookId = $createWebhookResponse.Body.id
Write-Host "  Webhook ID: $webhookId" -ForegroundColor Gray
Write-Host "  Events: $($createWebhookResponse.Body.events -join ', ')" -ForegroundColor Gray
Write-Host ""

# List webhooks
Write-Host "3.2 List Webhook Endpoints" -ForegroundColor Cyan
$listWebhooksResponse = Invoke-ApiCall -Method "GET" -Endpoint "/v1/market/integrations/endpoints" -Token $token
Assert-Response "List webhook endpoints" 200 $listWebhooksResponse
Write-Host "  Found $($listWebhooksResponse.Body.Count) endpoints" -ForegroundColor Gray
Write-Host ""

# Get specific webhook
Write-Host "3.3 Get Specific Webhook Endpoint" -ForegroundColor Cyan
$getWebhookResponse = Invoke-ApiCall -Method "GET" -Endpoint "/v1/market/integrations/endpoints/$webhookId" -Token $token
Assert-Response "Get webhook endpoint" 200 $getWebhookResponse
Write-Host "  Webhook name: $($getWebhookResponse.Body.name)" -ForegroundColor Gray
Write-Host ""

# Update webhook
Write-Host "3.4 Update Webhook Endpoint" -ForegroundColor Cyan
$updateWebhookResponse = Invoke-ApiCall -Method "PATCH" -Endpoint "/v1/market/integrations/endpoints/$webhookId" -Token $token -Body @{
  name = "Updated Webhook Name"
  events = @(
    "contact.created",
    "contact.updated",
    "payment.failed"
  )
}

Assert-Response "Update webhook endpoint" 200 $updateWebhookResponse
Write-Host "  Updated name: $($updateWebhookResponse.Body.name)" -ForegroundColor Gray
Write-Host "  New events: $($updateWebhookResponse.Body.events.Count) events" -ForegroundColor Gray
Write-Host ""

# Test webhook
Write-Host "3.5 Test Webhook Endpoint" -ForegroundColor Cyan
$testWebhookResponse = Invoke-ApiCall -Method "POST" -Endpoint "/v1/market/integrations/endpoints/$webhookId/test" -Token $token
Assert-Response "Test webhook endpoint" 200 $testWebhookResponse
Write-Host "  Test result: $($testWebhookResponse.Body.success)" -ForegroundColor Gray
Write-Host ""

# Toggle webhook
Write-Host "3.6 Toggle Webhook Endpoint" -ForegroundColor Cyan
$toggleWebhookResponse = Invoke-ApiCall -Method "POST" -Endpoint "/v1/market/integrations/endpoints/$webhookId/toggle" -Token $token
Assert-Response "Toggle webhook endpoint" 200 $toggleWebhookResponse
Write-Host "  Enabled: $($toggleWebhookResponse.Body.is_enabled)" -ForegroundColor Gray
Write-Host ""

# Get deliveries
Write-Host "3.7 List Webhook Deliveries" -ForegroundColor Cyan
$listDeliveriesResponse = Invoke-ApiCall -Method "GET" -Endpoint "/v1/market/integrations/deliveries?endpoint_id=$webhookId&limit=10" -Token $token
Assert-Response "List webhook deliveries" 200 $listDeliveriesResponse
Write-Host "  Found $($listDeliveriesResponse.Body.Count) deliveries" -ForegroundColor Gray
Write-Host ""

# Get webhook stats
Write-Host "3.8 Get Webhook Statistics" -ForegroundColor Cyan
$statsResponse = Invoke-ApiCall -Method "GET" -Endpoint "/v1/market/integrations/endpoints/$webhookId/stats" -Token $token
if ($statsResponse.Success) {
  Write-Host "✓ PASS: Get webhook statistics" -ForegroundColor Green
  Write-Host "  Total deliveries: $($statsResponse.Body.total_deliveries)" -ForegroundColor Gray
  Write-Host "  Successful: $($statsResponse.Body.successful)" -ForegroundColor Gray
  Write-Host "  Failed: $($statsResponse.Body.failed)" -ForegroundColor Gray
  Write-Host "  Success rate: $($statsResponse.Body.success_rate)%" -ForegroundColor Gray
  $results.Passed++
}
else {
  Write-Host "✗ FAIL: Get webhook statistics (Status: $($statsResponse.Status))" -ForegroundColor Red
  $results.Failed++
}
Write-Host ""

# Delete webhook
Write-Host "3.9 Delete Webhook Endpoint" -ForegroundColor Cyan
$deleteWebhookResponse = Invoke-ApiCall -Method "DELETE" -Endpoint "/v1/market/integrations/endpoints/$webhookId" -Token $token
Assert-Response "Delete webhook endpoint" 204 $deleteWebhookResponse
Write-Host ""

# Delete template
Write-Host "2.6 Delete Import Template" -ForegroundColor Cyan
$deleteTemplateResponse = Invoke-ApiCall -Method "DELETE" -Endpoint "/contacts/import-templates/$templateId" -Token $token
Assert-Response "Delete import template" 204 $deleteTemplateResponse
Write-Host ""

# Summary
Write-Host "=== Test Results ===" -ForegroundColor Cyan
Write-Host "Passed: $($results.Passed)" -ForegroundColor Green
Write-Host "Failed: $($results.Failed)" -ForegroundColor $(if ($results.Failed -eq 0) { "Green" } else { "Red" })
Write-Host "Total:  $($results.Passed + $results.Failed)" -ForegroundColor Cyan
Write-Host ""

if ($results.Failed -eq 0) {
  Write-Host "✓ All tests passed!" -ForegroundColor Green
  exit 0
}
else {
  Write-Host "✗ Some tests failed!" -ForegroundColor Red
  exit 1
}
