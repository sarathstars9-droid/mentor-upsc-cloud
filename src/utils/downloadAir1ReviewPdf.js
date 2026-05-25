import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import React from "react";
import { createRoot } from "react-dom/client";
import Air1VisualPdfExport from "../components/mains/air1Review/Air1VisualPdfExport";

export async function downloadAir1ReviewPdf({
  data,
  questionText,
  marks,
  paper,
  year,
  wordLimit,
  fileName = "MentorOS-AIR1-Review.pdf",
} = {}) {
  if (!data) {
    alert("AIR-1 data is missing for PDF export.");
    return;
  }

  // Create offscreen container and render the PDF-only React component
  const wrapper = document.createElement("div");
  wrapper.id = "air1-pdf-render-root";
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "794px"; // A4 px width for 96dpi approx
  wrapper.style.height = "1123px";
  wrapper.style.overflow = "hidden";
  document.body.appendChild(wrapper);

  const root = createRoot(wrapper);
  root.render(
    React.createElement(Air1VisualPdfExport, { data, questionText, marks, paper, year, wordLimit })
  );

  // Wait for layout and fonts
  await new Promise((r) => setTimeout(r, 600));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 200));

  try {
    const pages = wrapper.querySelectorAll(".air1-pdf-page");
    if (!pages || pages.length === 0) {
      alert("PDF pages not rendered. Please try again.");
      root.unmount();
      wrapper.remove();
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imageWidth = pageWidth - margin * 2;

    let first = true;

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];

      // Capture each page individually
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fafafc",
        onclone: (clonedDoc) => {
          clonedDoc
            .querySelectorAll("[data-air1-pdf-hide='true']")
            .forEach((el) => (el.style.visibility = "hidden"));
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * imageWidth) / imgProps.width;

      if (!first) pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, margin, imageWidth, imgHeight);
      first = false;
    }

    pdf.save(fileName);
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("An error occurred while generating the PDF. Please try again.");
  } finally {
    try {
      root.unmount();
    } catch (e) {}
    wrapper.remove();
  }
}
