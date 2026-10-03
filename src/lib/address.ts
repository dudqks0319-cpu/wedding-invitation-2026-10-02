/** Whitelist only the address fields returned by the external postcode service. */
export function selectedRoadAddress(value: unknown) {
  const invalid = () => new Error("선택한 주소를 확인하지 못했어요. 다시 검색해 주세요.");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const x = value as Record<string, unknown>;
  function field(key: string, max: number) {
    const v = x[key] ?? "";
    if (typeof v !== "string" || v.length > max || /[\r\n\x00]/.test(v)) throw invalid();
    return v.trim();
  }
  const road = field("roadAddress", 200);
  const address = road || field("jibunAddress", 200) || field("address", 200);
  if (!address) throw invalid();
  return { address, buildingName: field("buildingName", 80), kind: road ? "road" as const : "lot" as const };
}
