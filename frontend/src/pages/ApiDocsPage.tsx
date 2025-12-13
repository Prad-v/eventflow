/**
 * API Documentation Page - Embedded Swagger UI
 */
import { useEffect, useRef } from 'react';

export default function ApiDocsPage() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Dynamically load Swagger UI
        const loadSwaggerUI = async () => {
            // Load Swagger UI CSS
            const linkElement = document.createElement('link');
            linkElement.rel = 'stylesheet';
            linkElement.href = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css';
            document.head.appendChild(linkElement);

            // Load Swagger UI Bundle
            const scriptElement = document.createElement('script');
            scriptElement.src = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js';
            scriptElement.onload = () => {
                // @ts-ignore - SwaggerUIBundle is loaded dynamically
                if (window.SwaggerUIBundle && containerRef.current) {
                    // @ts-ignore
                    window.SwaggerUIBundle({
                        url: `${import.meta.env.VITE_API_URL || ''}/openapi.json`,
                        domNode: containerRef.current,
                        deepLinking: true,
                        presets: [
                            // @ts-ignore
                            window.SwaggerUIBundle.presets.apis,
                            // @ts-ignore
                            window.SwaggerUIBundle.SwaggerUIStandalonePreset,
                        ],
                        layout: 'BaseLayout',
                        defaultModelsExpandDepth: 1,
                        defaultModelExpandDepth: 1,
                        docExpansion: 'list',
                        filter: true,
                        showExtensions: true,
                        showCommonExtensions: true,
                    });
                }
            };
            document.body.appendChild(scriptElement);

            return () => {
                linkElement.remove();
                scriptElement.remove();
            };
        };

        loadSwaggerUI();
    }, []);

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <h1>API Documentation</h1>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                    Interactive API documentation powered by OpenAPI specification
                </p>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                    ref={containerRef}
                    style={{
                        minHeight: '600px',
                        background: '#1a1a2e',
                    }}
                />
            </div>

            <div style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                <p>
                    <strong>Direct Links:</strong>{' '}
                    <a
                        href={`${import.meta.env.VITE_API_URL || ''}/docs`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        Swagger UI
                    </a>
                    {' • '}
                    <a
                        href={`${import.meta.env.VITE_API_URL || ''}/redoc`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        ReDoc
                    </a>
                    {' • '}
                    <a
                        href={`${import.meta.env.VITE_API_URL || ''}/openapi.json`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        OpenAPI JSON
                    </a>
                </p>
            </div>
        </div>
    );
}
