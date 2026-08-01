import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function upsertMetaByName(name, content) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
  
  const duplicates = document.querySelectorAll(`meta[name="${name}"]`);
  for (let i = 1; i < duplicates.length; i++) {
    duplicates[i].remove();
  }
}

function removeMetaByName(name) {
  const tags = document.querySelectorAll(`meta[name="${name}"]`);
  tags.forEach(tag => tag.remove());
}

function upsertMetaByProperty(property, content) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
  
  const duplicates = document.querySelectorAll(`meta[property="${property}"]`);
  for (let i = 1; i < duplicates.length; i++) {
    duplicates[i].remove();
  }
}

function removeMetaByProperty(property) {
  const tags = document.querySelectorAll(`meta[property="${property}"]`);
  tags.forEach(tag => tag.remove());
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
  
  const duplicates = document.querySelectorAll('link[rel="canonical"]');
  for (let i = 1; i < duplicates.length; i++) {
    duplicates[i].remove();
  }
}

function removeCanonical() {
  const tags = document.querySelectorAll('link[rel="canonical"]');
  tags.forEach(tag => tag.remove());
}

function upsertJsonLd() {
  let script = document.getElementById("mentorupsc-structured-data");
  if (!script) {
    script = document.createElement('script');
    script.id = "mentorupsc-structured-data";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.mentorupsc.in/#organization",
        "name": "MentorUPSC",
        "url": "https://www.mentorupsc.in/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.mentorupsc.in/brand/mentorupsc-logo-full.png"
        },
        "sameAs": [
          "https://www.instagram.com/iupscmentor/"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://www.mentorupsc.in/#website",
        "url": "https://www.mentorupsc.in/",
        "name": "MentorUPSC",
        "publisher": {
          "@id": "https://www.mentorupsc.in/#organization"
        }
      }
    ]
  };
  
  script.textContent = JSON.stringify(data);
  
  const duplicates = document.querySelectorAll('script#mentorupsc-structured-data');
  for (let i = 1; i < duplicates.length; i++) {
    duplicates[i].remove();
  }
}

function removeJsonLd() {
  const tags = document.querySelectorAll('script#mentorupsc-structured-data');
  tags.forEach(tag => tag.remove());
}

export default function RouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    if (path === "/") {
      document.title = "MentorUPSC | Personal UPSC Mentor & Execution OS";
      upsertMetaByName("description", "MentorUPSC helps committed UPSC aspirants plan realistically, execute consistently, master PYQs, revise mistakes and improve answer writing with personal mentor guidance.");
      upsertMetaByName("robots", "index, follow");
      setCanonical("https://www.mentorupsc.in/");
      
      // Open Graph
      upsertMetaByProperty("og:title", "MentorUPSC | Personal UPSC Mentor & Execution OS");
      upsertMetaByProperty("og:description", "MentorUPSC helps committed UPSC aspirants plan realistically, execute consistently, master PYQs, revise mistakes and improve answer writing with personal mentor guidance.");
      upsertMetaByProperty("og:type", "website");
      upsertMetaByProperty("og:url", "https://www.mentorupsc.in/");
      upsertMetaByProperty("og:image", "https://www.mentorupsc.in/brand/mentorupsc-og.png");
      upsertMetaByProperty("og:image:secure_url", "https://www.mentorupsc.in/brand/mentorupsc-og.png");
      upsertMetaByProperty("og:image:width", "1200");
      upsertMetaByProperty("og:image:height", "630");
      upsertMetaByProperty("og:image:type", "image/png");
      upsertMetaByProperty("og:image:alt", "MentorUPSC — Built for Focus. Driven by Progress.");
      
      // Twitter
      upsertMetaByName("twitter:card", "summary");
      upsertMetaByName("twitter:title", "MentorUPSC | Personal UPSC Mentor & Execution OS");
      upsertMetaByName("twitter:description", "MentorUPSC helps committed UPSC aspirants plan realistically, execute consistently, master PYQs, revise mistakes and improve answer writing with personal mentor guidance.");
      upsertMetaByName("twitter:image", "https://www.mentorupsc.in/brand/mentorupsc-og.png");
      upsertMetaByName("twitter:image:alt", "MentorUPSC — Built for Focus. Driven by Progress.");
      
      upsertJsonLd();
    } else {
      // Non-homepage routes
      if (path === "/login") {
        document.title = "Login | MentorUPSC";
      } else if (path === "/privacy") {
        document.title = "Privacy | MentorUPSC";
      } else if (path === "/terms") {
        document.title = "Terms | MentorUPSC";
      } else if (path === "/contact") {
        document.title = "Contact | MentorUPSC";
      } else {
        document.title = "MentorOS | MentorUPSC";
      }
      
      upsertMetaByName("robots", "noindex, nofollow");
      
      removeCanonical();
      removeMetaByName("description");
      
      removeMetaByProperty("og:title");
      removeMetaByProperty("og:description");
      removeMetaByProperty("og:type");
      removeMetaByProperty("og:url");
      removeMetaByProperty("og:image");
      removeMetaByProperty("og:image:secure_url");
      removeMetaByProperty("og:image:width");
      removeMetaByProperty("og:image:height");
      removeMetaByProperty("og:image:type");
      removeMetaByProperty("og:image:alt");
      
      removeMetaByName("twitter:card");
      removeMetaByName("twitter:title");
      removeMetaByName("twitter:description");
      removeMetaByName("twitter:image");
      removeMetaByName("twitter:image:alt");
      
      removeJsonLd();
    }

  }, [location.pathname]);

  return null;
}


