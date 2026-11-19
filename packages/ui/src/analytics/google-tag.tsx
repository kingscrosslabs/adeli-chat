import Script from "next/script";

/**
 * Google Tag Manager, loaded on every page of the app that renders it in its
 * root layout. Only when `GTM_ID` is set: self-hosted installs leave it empty
 * and never load the script. Read at build time on static pages, so redeploy
 * after changing it.
 */
export function GoogleTag() {
  const id = process.env.GTM_ID?.trim();
  if (!id) return null;
  return (
    <>
      <Script id="gtm-src" src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
      <Script id="gtm-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());`}
      </Script>
    </>
  );
}
