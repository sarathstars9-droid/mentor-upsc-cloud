export function analyzePyqs(pyqs) {
  return {
    total: pyqs.length,
    prelims: pyqs.filter(p => p.paper === "Prelims").length,
    mains: pyqs.filter(p => p.paper === "Mains").length,
  };
}
