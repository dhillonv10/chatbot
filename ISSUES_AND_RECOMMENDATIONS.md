# Repository Issues and Recommendations

## Issues Fixed

### 1. ✅ Outdated Claude API Version
- **Fixed**: Updated from `claude-3-5-sonnet-20241022` to `claude-sonnet-4-5-20250929`
- **Location**: `lib/ai/models.ts:14`
- **Impact**: Now using the latest Sonnet 4.5 model with improved capabilities

### 2. ✅ Outdated Anthropic SDK
- **Fixed**: Updated from `@anthropic-ai/sdk@0.18.0` to `@anthropic-ai/sdk@0.69.0`
- **Impact**: Access to latest API features, bug fixes, and improvements

### 3. ✅ CRITICAL: Incorrect PDF Handling
- **Problem**: PDFs were sent as URLs to Anthropic API, which doesn't support this format
- **Fixed**:
  - Created `lib/attachment-utils.ts` with proper PDF/image handling
  - PDFs are now downloaded from Vercel Blob and base64-encoded
  - Images use URL format (supported by API)
  - Updated `app/(chat)/api/chat/route.ts` to use proper format
- **Impact**: File uploads now work correctly with Anthropic's API

## Remaining Issues & Recommendations

### Security Concerns

#### 1. No File Upload Validation
**Severity**: HIGH
**Location**: `app/(chat)/api/files/upload/route.ts`

**Issues**:
- No rate limiting on file uploads
- No validation that uploaded URLs are from Vercel Blob
- Users could potentially share URLs to malicious content
- 32MB file size could lead to high Vercel Blob costs

**Recommendations**:
```typescript
// Add rate limiting (consider using @vercel/edge-config or upstash)
// Validate URLs are from your Vercel Blob domain
// Consider reducing max file size to 10-15MB
// Add authentication checks per user quotas
```

#### 2. Missing Input Sanitization
**Severity**: MEDIUM
**Location**: Throughout the application

**Issues**:
- User inputs are not sanitized before being sent to the AI
- Could potentially lead to prompt injection attacks

**Recommendations**:
- Add input validation and sanitization
- Consider implementing content filtering
- Add rate limiting per user

### Code Quality Issues

#### 1. Poor TypeScript Type Safety
**Severity**: MEDIUM
**Locations**:
- `lib/ai/index.ts:38` - `messages: any[]`
- Various other locations using `any`

**Issues**:
- Using `any` types defeats the purpose of TypeScript
- Makes code harder to maintain and debug
- Can hide runtime errors

**Recommendations**:
```typescript
// Define proper types for messages
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

// Replace any with proper types
async invoke({ messages, options }: {
  messages: AnthropicMessage[];
  options?: { system?: string }
})
```

#### 2. Custom Streaming Implementation
**Severity**: LOW-MEDIUM
**Location**: `lib/ai/index.ts`

**Issues**:
- Reinventing the wheel instead of using Vercel AI SDK's built-in streaming
- More complex and error-prone
- Harder to maintain

**Recommendations**:
- Consider migrating to Vercel AI SDK's native streaming utilities
- Would reduce code complexity and improve reliability

#### 3. Canary Dependency Version
**Severity**: LOW
**Location**: `package.json:35`

**Issue**:
- Using `ai: 4.0.0-canary.9` (unstable canary version)
- Could have unexpected breaking changes

**Recommendation**:
- Upgrade to stable version when available
- Monitor for breaking changes

### Performance Concerns

#### 1. Inefficient PDF Processing
**Severity**: MEDIUM
**Location**: `lib/attachment-utils.ts`

**Current Implementation**:
- Downloads entire PDF into memory
- Converts to base64 (increases size by ~33%)
- Could cause memory issues with large files

**Recommendations**:
- Add streaming support for large files
- Implement chunking for PDFs over certain size
- Consider client-side base64 encoding to reduce server load
- Add caching for frequently accessed files

#### 2. No Caching Strategy
**Severity**: LOW
**Location**: Throughout application

**Issues**:
- No caching of API responses
- No caching of file conversions
- Could lead to unnecessary API calls and costs

**Recommendations**:
- Implement response caching for common queries
- Cache base64-encoded files temporarily
- Use Vercel Edge Config or similar for caching

### Database & Architecture

#### 1. No File Metadata Tracking
**Severity**: MEDIUM
**Location**: Database schema

**Issues**:
- Uploaded files aren't tracked in the database
- No way to audit file usage
- Can't clean up orphaned files in Vercel Blob
- No file quota enforcement per user

**Recommendations**:
```sql
-- Add file tracking table
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  file_url VARCHAR NOT NULL,
  file_name VARCHAR NOT NULL,
  file_size INTEGER NOT NULL,
  content_type VARCHAR NOT NULL,
  chat_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add index for cleanup queries
CREATE INDEX idx_uploaded_files_created_at ON uploaded_files(created_at);
```

#### 2. No Error Tracking
**Severity**: MEDIUM

**Issues**:
- Console.log used for errors instead of proper logging
- No error tracking service integrated
- Hard to debug production issues

**Recommendations**:
- Integrate Sentry or similar error tracking
- Add structured logging
- Implement proper error boundaries

### Environment & Configuration

#### 1. No Environment Variable Validation
**Severity**: MEDIUM
**Location**: Throughout application

**Issues**:
- Only ANTHROPIC_API_KEY is validated
- Missing validation for database, blob storage, etc.
- Could lead to runtime errors in production

**Recommendations**:
```typescript
// Create lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  // Add all required env vars
});

export const env = envSchema.parse(process.env);
```

### Testing

#### 1. No Tests
**Severity**: HIGH

**Issues**:
- No unit tests
- No integration tests
- No E2E tests
- High risk of regressions

**Recommendations**:
- Add Jest for unit tests
- Add Playwright for E2E tests
- Focus on critical paths:
  - File upload and processing
  - API message formatting
  - Authentication flows

## Priority Recommendations

### High Priority (Implement ASAP)
1. ✅ Fix PDF handling (COMPLETED)
2. ✅ Update Claude API version (COMPLETED)
3. Add file upload rate limiting and validation
4. Add file metadata tracking to database
5. Implement proper error tracking

### Medium Priority (Next Sprint)
1. Fix TypeScript type safety issues
2. Add environment variable validation
3. Implement basic test coverage
4. Add file upload quotas per user
5. Optimize PDF processing for large files

### Low Priority (Future Improvements)
1. Migrate to Vercel AI SDK native streaming
2. Implement response caching
3. Add comprehensive test suite
4. Upgrade to stable AI SDK version
5. Add monitoring and analytics

## Cost Optimization

### Vercel Blob Storage
- **Current**: 32MB max file size, no cleanup
- **Recommendation**:
  - Implement automatic file cleanup after 30 days
  - Add per-user storage quotas
  - Consider cheaper alternatives for long-term storage

### Anthropic API Costs
- **Current**: No caching, could make duplicate calls
- **Recommendation**:
  - Implement request deduplication
  - Cache common responses
  - Add user rate limiting

## Security Checklist

- [ ] Implement rate limiting on all API endpoints
- [ ] Add CSRF protection
- [ ] Validate all file uploads are from trusted sources
- [ ] Implement content security policy
- [ ] Add input sanitization for AI prompts
- [ ] Implement per-user quotas
- [ ] Add audit logging for sensitive operations
- [ ] Review and update dependencies regularly
- [ ] Implement proper error handling (don't expose internals)
- [ ] Add monitoring for suspicious activity
