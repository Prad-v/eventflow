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
