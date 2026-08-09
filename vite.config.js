import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "apps/web/pages/home/index.html"),
        demo: resolve(__dirname, "apps/web/pages/demo/index.html"),
        demoRestaurants: resolve(__dirname, "apps/web/pages/demo/restaurants/index.html"),
        demoRealEstate: resolve(__dirname, "apps/web/pages/demo/real-estate/index.html"),
        demoGym: resolve(__dirname, "apps/web/pages/demo/gym/index.html"),
        demoEcommerce: resolve(__dirname, "apps/web/pages/demo/ecommerce/index.html"),
        demoAgencies: resolve(__dirname, "apps/web/pages/demo/agencies/index.html"),
        demoVeterinary: resolve(__dirname, "apps/web/pages/demo/veterinary/index.html"),
        demoAesthetics: resolve(__dirname, "apps/web/pages/demo/aesthetics/index.html"),
        nicheGym: resolve(__dirname, "apps/web/pages/gym/index.html"),
        nicheRestaurants: resolve(__dirname, "apps/web/pages/restaurants/index.html"),
        nicheRealEstate: resolve(__dirname, "apps/web/pages/real-estate/index.html"),
        nicheEcommerce: resolve(__dirname, "apps/web/pages/ecommerce/index.html"),
        nicheAgencies: resolve(__dirname, "apps/web/pages/agencies/index.html"),
        nicheVeterinary: resolve(__dirname, "apps/web/pages/veterinary/index.html"),
        nicheAesthetics: resolve(__dirname, "apps/web/pages/aesthetics/index.html"),
        auth: resolve(__dirname, "apps/admin/auth.html"),
        invite: resolve(__dirname, "apps/admin/invite.html"),
        reset: resolve(__dirname, "apps/admin/reset.html"),
        app: resolve(__dirname, "apps/admin/app.html"),
        admin: resolve(__dirname, "apps/admin/admin.html"),
        crm: resolve(__dirname, "apps/admin/crm.html"),
        legalTerminos: resolve(__dirname, "apps/web/pages/legal/terminos/index.html"),
        legalPrivacidad: resolve(__dirname, "apps/web/pages/legal/privacidad/index.html"),
        legalReembolsos: resolve(__dirname, "apps/web/pages/legal/reembolsos/index.html"),
        pricing: resolve(__dirname, "apps/web/pages/pricing/index.html"),
      },
    },
  },
});
