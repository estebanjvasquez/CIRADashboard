# CIRADashboard: Pipeline & Web Dashboard de Métricas del Bot

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20TypeScript%20%7C%20Cloudflare%20%7C%20Supabase-orange)

## Propósito

**CIRADashboard** es una aplicación serverless y dashboard web privado de bajo costo diseñado para leer logs de interacción del bot almacenados en Supabase (`audit_log_entries`), parsear datos estructurados (JSON en `respuesta_ia` y `metadata`) y semiestructurados (HTML en `output`), y generar métricas gerenciales y operativas accionables.

---

## Estructura del Repositorio (Mejores Prácticas Anthropic & Google)

El proyecto sigue una arquitectura limpia y modular para facilitar la mantenibilidad y el desarrollo asistido por IA:

```text
CIRADashboard/
├── README.md                   # Documentación principal del repositorio
├── CLAUDE.md                   # Contexto operacional y guías para Anthropic Claude
├── AGENTS.md                   # Instrucciones persistentes para Google / Codex
├── .gitignore                  # Configuración de exclusiones Git
├── docs/                       # Documentación técnica organizada por dominio
│   ├── specs/                  # Especificaciones de producto, arquitectura y datos
│   │   ├── 01-product-spec.md
│   │   ├── 02-technical-architecture.md
│   │   ├── 03-data-model.md
│   │   ├── 04-etl-processing-spec.md
│   │   └── 05-web-dashboard-spec.md
│   ├── deployment/             # Guía de despliegue en Cloudflare y Supabase
│   │   └── 06-deployment-cloudflare-supabase-dashboard.md
│   ├── operations/             # Seguridad, anonimización de IPs y monitoreo
│   │   └── 07-security-and-operations.md
│   ├── ai/                     # Prompts y buenas prácticas de desarrollo IA
│   │   ├── 08-ide-ai-implementation-prompt.md
│   │   ├── 09-ai-development-best-practices.md
│   │   └── 10-agent-instructions-templates.md
│   └── qa/                     # Plan de pruebas, fixtures y criterios de calidad
│       └── 11-acceptance-tests-and-qa.md
├── src/                        # Código fuente de la aplicación
│   ├── etl/                    # Parsers puros (HTML/JSON) y conectores
│   ├── dashboard/              # Componentes de interfaz de usuario React
│   └── shared/                 # Modelos y tipos TypeScript compartidos
├── tests/                      # Suite de pruebas automatizadas
│   ├── unit/                   # Tests unitarios para parsers y agregadores
│   └── fixtures/               # Datos de prueba anonimizados
└── scripts/                    # Scripts utilitarios y de mantenimiento
```

---

## Índice de Documentación (`docs/`)

| Sección | Archivo | Descripción |
|---|---|---|
| **Especificaciones** | [01-product-spec.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/specs/01-product-spec.md) | Alcance funcional, usuarios, KPIs y criterios de éxito |
| | [02-technical-architecture.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/specs/02-technical-architecture.md) | Arquitectura serverless en Cloudflare, flujo y endpoints API |
| | [03-data-model.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/specs/03-data-model.md) | Modelo de datos de entrada/salida y esquema limpio |
| | [04-etl-processing-spec.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/specs/04-etl-processing-spec.md) | Lógica detallada del pipeline ETL y parsing |
| | [05-web-dashboard-spec.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/specs/05-web-dashboard-spec.md) | Especificación de la interfaz React, gráficos y filtros |
| **Despliegue** | [06-deployment.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/deployment/06-deployment-cloudflare-supabase-dashboard.md) | Guía de configuración en Cloudflare Pages/Worker y variables |
| **Operaciones** | [07-security-ops.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/operations/07-security-and-operations.md) | Seguridad de credenciales, hashing de IP y retención |
| **Desarrollo IA** | [08-ai-prompt.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/ai/08-ide-ai-implementation-prompt.md) | Prompt maestro de implementación para agentes IA |
| | [09-best-practices.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/ai/09-ai-development-best-practices.md) | Buenas prácticas de Anthropic, OpenAI y Google |
| | [10-templates.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/ai/10-agent-instructions-templates.md) | Plantillas para `CLAUDE.md` y `AGENTS.md` |
| **QA y Pruebas** | [11-qa-tests.md](file:///c:/Users/EstebanVasquez/OneDrive%20-%20MSFT/Documents/GitHub/CIRADashboard/docs/qa/11-acceptance-tests-and-qa.md) | Suite de pruebas unitarias, fixtures e integración |

---

## Comandos Principales

```bash
# Instalar dependencias del proyecto
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Ejecutar pruebas unitarias con Vitest
npm run test

# Verificar tipos TypeScript
npm run typecheck

# Compilar proyecto para producción
npm run build

# Desplegar a Cloudflare Pages
npm run deploy
```

---

## Seguridad y Privacidad

- **Secretos**: Las claves privadas (ej. `SUPABASE_SERVICE_ROLE_KEY`) **NUNCA** se commitean al repositorio y se gestionan mediante Cloudflare Secrets.
- **Privacidad**: Las direcciones IP de los usuarios se anonimizan utilizando un hash SHA-256 (`IP_HASH_SALT`).
- **Autenticación**: El dashboard y la API están protegidos en producción mediante Cloudflare Access.
