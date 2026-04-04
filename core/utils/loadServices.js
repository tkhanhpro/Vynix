import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

async function loadServices() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const servicesDir = path.join(__dirname, "..", "services");
  const services = {};

  try {
    const files = fs.readdirSync(servicesDir, { withFileTypes: true });

    for (const file of files) {
      if (file.isDirectory() || !file.name.endsWith(".js")) {
        continue;
      }

      const serviceName = file.name.replace(/\.js$/, "");

      const importPath = path.join(__dirname, `../services/${serviceName}.js`);

      try {
        const module = await import(importPath);

        const service = module.default !== undefined ? module.default : module;

        if (service != null) {
          services[serviceName] = service;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
          const importPathNoExt = path.join(__dirname, `../services/${serviceName}`);
          const module = await import(importPathNoExt);
          const service = module.default !== undefined ? module.default : module;
          if (service != null) {
            services[serviceName] = service;
          }
        } catch (fallbackError) {
          console.warn(`Không thể load service ${serviceName}: ${err.message || String(error)}`);
        }
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn(`Không thể đọc thư mục services: ${err.message || String(error)}`);
  }

  return services;
}

export default loadServices;