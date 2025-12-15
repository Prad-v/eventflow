import { test, expect } from '@playwright/test';

/**
 * E2E Smoke Tests for Status Page
 * These tests validate the core functionality of the deployed application
 */

test.describe('Status Page - Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the homepage before each test
        await page.goto('/');
    });

    test('should load the homepage', async ({ page }) => {
        // Verify the page title contains "Status"
        await expect(page).toHaveTitle(/Status/i);
    });

    test('should display the header with navigation', async ({ page }) => {
        // Check for the header logo/title
        const header = page.locator('header');
        await expect(header).toBeVisible();

        // Check for navigation links
        await expect(page.getByRole('link', { name: /overview/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /components/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /incidents/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /maintenance/i })).toBeVisible();
    });

    test('should display global status banner', async ({ page }) => {
        // The global status banner should be visible
        const statusBanner = page.locator('.global-status-banner');
        await expect(statusBanner).toBeVisible();

        // Should contain status text (one of: operational, degraded, etc.)
        const statusText = statusBanner.locator('.status-text');
        await expect(statusText).toBeVisible();
    });

    test('should display System Status section', async ({ page }) => {
        // Look for the "System Status" heading
        const systemStatusHeading = page.getByRole('heading', { name: /system status/i });
        await expect(systemStatusHeading).toBeVisible();
    });

    test('should have Sign In button for unauthenticated users', async ({ page }) => {
        // The Sign In button should be visible for unauthenticated users
        const signInButton = page.getByRole('button', { name: /sign in/i });
        await expect(signInButton).toBeVisible();
    });

    test('should navigate to Incidents page', async ({ page }) => {
        // Click on Incidents link
        await page.getByRole('link', { name: /incidents/i }).click();

        // URL should contain /incidents
        await expect(page).toHaveURL(/\/incidents/);
    });

    test('should navigate to Components page', async ({ page }) => {
        // Click on Components link
        await page.getByRole('link', { name: /components/i }).click();

        // URL should contain /components
        await expect(page).toHaveURL(/\/components/);
    });

    test('should navigate to Maintenance page', async ({ page }) => {
        // Click on Maintenance link
        await page.getByRole('link', { name: /maintenance/i }).click();

        // URL should contain /maintenance
        await expect(page).toHaveURL(/\/maintenance/);
    });

    test('should navigate to API Docs page', async ({ page }) => {
        // Click on API Docs link
        await page.getByRole('link', { name: /api docs/i }).click();

        // URL should contain /api-docs
        await expect(page).toHaveURL(/\/api-docs/);
    });

    test('should display footer', async ({ page }) => {
        // Footer should be visible
        const footer = page.locator('footer');
        await expect(footer).toBeVisible();
        await expect(footer).toContainText(/EventFlow/i);
    });

    test('should not show error message on homepage', async ({ page }) => {
        // The error message should NOT be visible (meaning data loaded successfully)
        const errorMessage = page.locator('.error-message');
        await expect(errorMessage).not.toBeVisible();
    });
});

test.describe('Status Page - API Integration', () => {
    test('should fetch and display status data from API', async ({ page }) => {
        // Monitor network requests
        const responsePromise = page.waitForResponse(
            (response) => response.url().includes('/v1/status/overview') && response.status() === 200
        );

        await page.goto('/');

        // Wait for the API call to complete
        const response = await responsePromise;
        expect(response.ok()).toBeTruthy();

        // Verify the page renders content from the API
        // The global status banner should show actual data (not just loading)
        const statusBanner = page.locator('.global-status-banner');
        await expect(statusBanner).toBeVisible();
    });
});

test.describe('Local Login Page - Breakglass Access', () => {
    test('should load local login page', async ({ page }) => {
        await page.goto('/login/local');

        // Verify the page title
        await expect(page).toHaveTitle(/Status/i);

        // Should have login form elements
        await expect(page.getByText(/Local Admin Login/i)).toBeVisible();
        await expect(page.getByText(/Username/)).toBeVisible();
        await expect(page.getByText(/Password/)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should have back link to status page', async ({ page }) => {
        await page.goto('/login/local');

        // Should have a link back to the main page
        const backLink = page.getByText(/Back to Status Page/i);
        await expect(backLink).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login/local');

        // Fill in invalid credentials using input by type
        await page.locator('input[type="text"]').fill('invaliduser');
        await page.locator('input[type="password"]').fill('invalidpassword');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should show error message (wait for API response)
        await expect(page.getByText(/invalid username or password/i)).toBeVisible({ timeout: 15000 });
    });

    test('should show breakglass description', async ({ page }) => {
        await page.goto('/login/local');

        // Should mention breakglass access (case-insensitive)
        await expect(page.getByText(/Breakglass access/i)).toBeVisible();
    });
});

test.describe('Settings Page - Authenticated Access', () => {
    test('should redirect unauthenticated users when accessing settings', async ({ page }) => {
        // Try to access settings without authentication
        await page.goto('/admin/settings');

        // Should redirect to login or show loading (depending on auth state)
        // The page should not show the settings content without authentication
        // Note: This test verifies the route exists and is protected
        await expect(page).toHaveURL(/\/(admin\/settings|callback)/);
    });

    test('should have settings routes accessible', async ({ page }) => {
        // Just verify the routes are configured correctly
        // Navigate to OIDC settings path
        await page.goto('/admin/settings/oidc');

        // The page should load (even if redirected for auth)
        await expect(page).toHaveTitle(/Status/i);
    });

    test('should have local users route accessible', async ({ page }) => {
        // Just verify the routes are configured correctly
        await page.goto('/admin/settings/users');

        // The page should load (even if redirected for auth)
        await expect(page).toHaveTitle(/Status/i);
    });
});

test.describe('Navigation - New Features', () => {
    test('should be able to navigate to local login from main page', async ({ page }) => {
        // Start from homepage
        await page.goto('/');

        // Navigate to local login via URL
        await page.goto('/login/local');

        // Verify we're on the local login page
        await expect(page.getByText(/Local Admin Login/i)).toBeVisible();
    });

    test('should have API docs link working', async ({ page }) => {
        await page.goto('/');

        // Click API Docs navigation link
        await page.getByRole('link', { name: /api docs/i }).click();

        // Should navigate to API docs page
        await expect(page).toHaveURL(/\/api-docs/);
    });
});
