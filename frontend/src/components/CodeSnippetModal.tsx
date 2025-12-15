import { useState } from 'react';

interface CodeSnippetModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityType: 'incident' | 'maintenance' | 'component';
}

type Language = 'curl' | 'shell' | 'python';

export function CodeSnippetModal({ isOpen, onClose, entityType }: CodeSnippetModalProps) {
    const [language, setLanguage] = useState<Language>('curl');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const getUrl = (path: string) => `http://localhost:8000/v1${path}`;

    const generateCode = () => {
        switch (entityType) {
            case 'incident':
                return generateIncidentCode(language, getUrl('/incidents'));
            case 'maintenance':
                return generateMaintenanceCode(language, getUrl('/maintenance'));
            case 'component':
                return generateComponentCode(language, getUrl('/components'));
            default:
                return '';
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generateCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '800px', margin: '20px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="card-header" style={{ marginBottom: '0', paddingBottom: '20px', borderBottom: '1px solid var(--color-border)' }}>
                    <h3 style={{ margin: 0 }}>Generate {entityType.charAt(0).toUpperCase() + entityType.slice(1)} API Code</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}>
                        ×
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px', padding: '20px 0', borderBottom: '1px solid var(--color-border)' }}>
                    {['curl', 'shell', 'python'].map((lang) => (
                        <button
                            key={lang}
                            onClick={() => setLanguage(lang as Language)}
                            className={`nav-link ${language === lang ? 'active' : ''}`}
                            style={{
                                textTransform: 'capitalize',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {lang}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '20px 0' }}>
                    <div style={{
                        background: '#1e1e1e',
                        padding: '20px',
                        borderRadius: 'var(--radius-md)',
                        position: 'relative',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        color: '#d4d4d4',
                        overflowX: 'auto'
                    }}>
                        <button
                            onClick={copyToClipboard}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '8px',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                        >
                            {copied ? '✓ Copied' : 'Copy'}
                        </button>
                        <pre style={{ margin: 0 }}>{generateCode()}</pre>
                    </div>
                </div>

                <div style={{
                    paddingTop: '20px',
                    borderTop: '1px solid var(--color-border)',
                    textAlign: 'right',
                    color: 'var(--color-text-muted)',
                    fontSize: '12px'
                }}>
                    Replace placeholders (like &lt;TOKEN&gt; or UUIDs) with actual values.
                </div>
            </div>
        </div>
    );
}

// Generators

function generateIncidentCode(lang: Language, url: string) {
    const data = {
        title: "Database Connection Failure",
        severity: "major",
        message: "We are investigating connection issues with the primary database.",
        components: [{ component_id: "REPLACE_WITH_COMPONENT_ID", impact: "outage" }]
    };

    if (lang === 'curl') {
        return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -d '${JSON.stringify(data, null, 2)}'`;
    }

    if (lang === 'shell') {
        return `#!/bin/bash
API_URL="${url}"
TOKEN="<YOUR_TOKEN>"

curl -X POST "$API_URL" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '${JSON.stringify(data, null, 2)}'`;
    }

    if (lang === 'python') {
        return `import requests
import json

url = "${url}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <YOUR_TOKEN>"
}
data = ${JSON.stringify(data, null, 4)}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 201:
    print("Incident created successfully:")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"Error {response.status_code}: {response.text}")`;
    }
    return '';
}

function generateMaintenanceCode(lang: Language, url: string) {
    const data = {
        title: "Scheduled Database Upgrade",
        description: "Upgrading PostgreSQL to version 15. This will involve downtime.",
        start_at: new Date(Date.now() + 86400000).toISOString(),
        end_at: new Date(Date.now() + 90000000).toISOString(),
        components: [{ component_id: "REPLACE_WITH_COMPONENT_ID", expected_impact: "outage" }]
    };

    if (lang === 'curl') {
        return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -d '${JSON.stringify(data, null, 2)}'`;
    }

    if (lang === 'shell') {
        return `#!/bin/bash
API_URL="${url}"
TOKEN="<YOUR_TOKEN>"

curl -X POST "$API_URL" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '${JSON.stringify(data, null, 2)}'`;
    }

    if (lang === 'python') {
        return `import requests
import json

url = "${url}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <YOUR_TOKEN>"
}
data = ${JSON.stringify(data, null, 4)}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 201:
    print("Maintenance window scheduled:")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"Error {response.status_code}: {response.text}")`;
    }
    return '';
}

function generateComponentCode(lang: Language, url: string) {
    const data = {
        name: "API Service",
        description: "Core backend API service",
        group_id: "REPLACE_WITH_GROUP_ID"
    };

    if (lang === 'curl') {
        return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -d '${JSON.stringify(data, null, 2)}'`;
    }

    if (lang === 'shell') {
        return `#!/bin/bash
API_URL="${url}"
TOKEN="<YOUR_TOKEN>"

curl -X POST "$API_URL" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '${JSON.stringify(data, null, 2)}'`;
    }

    if (lang === 'python') {
        return `import requests
import json

url = "${url}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <YOUR_TOKEN>"
}
data = ${JSON.stringify(data, null, 4)}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 201:
    print("Component created:")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"Error {response.status_code}: {response.text}")`;
    }
    return '';
}
