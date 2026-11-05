/**
 * Inline Data URIs for mock regulatory documents.
 * Using inline data URIs ensures that demo documents always render reliably
 * in any browser environment without depending on network requests, Vite public
 * directory cache states, or dev server restarts.
 */

const BUSINESS_PERMIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffdf8"/>
      <stop offset="100%" stop-color="#fdf6e7"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b8860b"/>
      <stop offset="50%" stop-color="#daa520"/>
      <stop offset="100%" stop-color="#8b6508"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.15"/>
    </filter>
  </defs>

  <rect x="20" y="20" width="760" height="1010" rx="8" fill="url(#bg)" stroke="url(#borderGrad)" stroke-width="8" filter="url(#shadow)"/>
  <rect x="36" y="36" width="728" height="978" rx="4" fill="none" stroke="#daa520" stroke-width="2" stroke-dasharray="8 4"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="400" y="90" font-size="14" fill="#666" letter-spacing="2">REPUBLIC OF THE PHILIPPINES</text>
    <text x="400" y="112" font-size="14" fill="#666" letter-spacing="1">PROVINCE OF BATANGAS</text>
    <text x="400" y="136" font-size="18" font-weight="bold" fill="#1e3a8a" letter-spacing="2">MUNICIPALITY OF MABINI</text>
    <text x="400" y="160" font-size="13" font-style="italic" fill="#555">OFFICE OF THE MUNICIPAL MAYOR</text>
    <text x="400" y="178" font-size="11" fill="#777">BPLO Tourism Licensing &amp; Operations Division</text>

    <circle cx="400" cy="235" r="38" fill="#1e3a8a" opacity="0.1"/>
    <circle cx="400" cy="235" r="34" fill="none" stroke="#1e3a8a" stroke-width="2"/>
    <polygon points="400,210 408,226 426,226 412,236 418,252 400,242 382,252 388,236 374,226 392,226" fill="#daa520"/>
    <text x="400" y="282" font-size="10" font-weight="bold" fill="#1e3a8a" letter-spacing="1">OFFICIAL SEAL • MABINI, BATANGAS</text>

    <text x="400" y="340" font-size="34" font-weight="bold" fill="#854d0e" letter-spacing="4">BUSINESS PERMIT</text>
    <text x="400" y="368" font-size="16" font-weight="bold" fill="#1e3a8a" letter-spacing="3">MAYOR'S PERMIT TO OPERATE</text>
    <line x1="200" y1="382" x2="600" y2="382" stroke="#daa520" stroke-width="2"/>
  </g>

  <g font-family="Arial, sans-serif" fill="#222">
    <rect x="80" y="410" width="640" height="90" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    <text x="105" y="440" font-size="11" fill="#64748b" font-weight="bold">PERMIT NUMBER</text>
    <text x="105" y="475" font-size="22" font-weight="bold" fill="#0f172a" font-family="'Courier New', monospace">MMDR-2026-0812</text>

    <text x="360" y="440" font-size="11" fill="#64748b" font-weight="bold">DATE ISSUED</text>
    <text x="360" y="470" font-size="14" font-weight="bold" fill="#0f172a">January 15, 2026</text>

    <text x="540" y="440" font-size="11" fill="#64748b" font-weight="bold">EXPIRY DATE</text>
    <text x="540" y="470" font-size="14" font-weight="bold" fill="#b91c1c">December 31, 2026</text>

    <rect x="80" y="520" width="640" height="230" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>

    <text x="105" y="555" font-size="11" fill="#64748b" font-weight="bold">BUSINESS NAME / TRADE NAME</text>
    <text x="105" y="592" font-size="20" font-weight="bold" fill="#1e3a8a">DEEP BLUE CHARTERS &amp; RESORT</text>

    <text x="105" y="635" font-size="11" fill="#64748b" font-weight="bold">REGISTERED OWNER / OPERATOR</text>
    <text x="105" y="660" font-size="15" font-weight="bold" fill="#334155">Rafael Magtibay</text>

    <text x="400" y="635" font-size="11" fill="#64748b" font-weight="bold">BUSINESS LOCATION / BARANGAY</text>
    <text x="400" y="660" font-size="14" fill="#334155">14 Coastal Road, Brgy. San Teodoro, Mabini</text>

    <line x1="105" y1="680" x2="695" y2="680" stroke="#f1f5f9" stroke-width="2"/>

    <text x="105" y="705" font-size="11" fill="#64748b" font-weight="bold">CLASSIFICATION</text>
    <text x="300" y="705" font-size="13" font-weight="bold" fill="#0f172a">Scuba Diving Resort &amp; Tourist Boat Operations</text>

    <text x="105" y="730" font-size="11" fill="#64748b" font-weight="bold">BARANGAY CLEARANCE NO.</text>
    <text x="300" y="730" font-size="13" fill="#334155">BC-STD-2026-00412</text>
  </g>

  <g font-family="Arial, sans-serif">
    <line x1="120" y1="920" x2="320" y2="920" stroke="#0f172a" stroke-width="1.5"/>
    <text x="220" y="940" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">HON. ATTY. JUAN DELA CRUZ</text>
    <text x="220" y="955" font-size="10" fill="#64748b" text-anchor="middle">Municipal Mayor</text>

    <line x1="480" y1="920" x2="680" y2="920" stroke="#0f172a" stroke-width="1.5"/>
    <text x="580" y="940" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">MARIA CONCEPCION SANTOS</text>
    <text x="580" y="955" font-size="10" fill="#64748b" text-anchor="middle">Head, Business Permit &amp; Licensing</text>

    <g transform="translate(350, 850)">
      <circle cx="50" cy="50" r="42" fill="none" stroke="#16a34a" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="50" cy="50" r="36" fill="none" stroke="#16a34a" stroke-width="1"/>
      <text x="50" y="42" font-size="8" font-weight="bold" fill="#16a34a" text-anchor="middle" letter-spacing="1">MABINI BPLO</text>
      <text x="50" y="55" font-size="12" font-weight="bold" fill="#16a34a" text-anchor="middle">VERIFIED</text>
      <text x="50" y="66" font-size="8" fill="#16a34a" text-anchor="middle">SERIES 2026</text>
    </g>
  </g>
</svg>`;

const PCSSD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050">
  <defs>
    <linearGradient id="pcssdBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0fdf4"/>
      <stop offset="100%" stop-color="#ecfdf5"/>
    </linearGradient>
    <linearGradient id="pcssdBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>

  <rect x="20" y="20" width="760" height="1010" rx="8" fill="url(#pcssdBg)" stroke="url(#pcssdBorder)" stroke-width="8"/>
  <rect x="36" y="36" width="728" height="978" rx="4" fill="none" stroke="#059669" stroke-width="2" stroke-dasharray="6 3"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="400" y="90" font-size="13" fill="#666" letter-spacing="2">REPUBLIC OF THE PHILIPPINES</text>
    <text x="400" y="112" font-size="14" fill="#666" letter-spacing="1">DEPARTMENT OF TOURISM</text>
    <text x="400" y="140" font-size="18" font-weight="bold" fill="#065f46" letter-spacing="2">PHILIPPINE COMMISSION ON SPORTS SCUBA DIVING</text>
    <text x="400" y="165" font-size="12" font-style="italic" fill="#047857">PCSSD Standard Safety &amp; Environmental Compliance</text>

    <circle cx="400" cy="225" r="36" fill="#059669" opacity="0.12"/>
    <circle cx="400" cy="225" r="32" fill="none" stroke="#059669" stroke-width="2"/>
    <text x="400" y="232" font-size="24" text-anchor="middle">🤿</text>

    <text x="400" y="315" font-size="30" font-weight="bold" fill="#065f46" letter-spacing="3">CERTIFICATE OF ACCREDITATION</text>
    <text x="400" y="342" font-size="15" font-weight="bold" fill="#047857" letter-spacing="2">RECREATIONAL SCUBA DIVING OPERATOR</text>
    <line x1="220" y1="355" x2="580" y2="355" stroke="#059669" stroke-width="2"/>
  </g>

  <g font-family="Arial, sans-serif" fill="#222">
    <rect x="80" y="380" width="640" height="80" rx="6" fill="#ffffff" stroke="#a7f3d0" stroke-width="1.5"/>
    <text x="105" y="410" font-size="11" fill="#047857" font-weight="bold">ACCREDITATION NUMBER</text>
    <text x="105" y="442" font-size="20" font-weight="bold" fill="#065f46" font-family="'Courier New', monospace">PCSSD-BAT-2026-0089</text>

    <text x="420" y="410" font-size="11" fill="#047857" font-weight="bold">VALIDITY PERIOD</text>
    <text x="420" y="442" font-size="14" font-weight="bold" fill="#0f172a">March 01, 2026 – February 28, 2027</text>

    <rect x="80" y="480" width="640" height="250" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>

    <text x="400" y="520" font-size="12" fill="#64748b" text-anchor="middle">This certifies that</text>
    <text x="400" y="555" font-size="22" font-weight="bold" fill="#065f46" text-anchor="middle">DEEP BLUE CHARTERS &amp; RESORT</text>
    <text x="400" y="585" font-size="13" fill="#334155" text-anchor="middle">San Teodoro, Mabini, Batangas (Anilao Dive Area)</text>

    <text x="400" y="630" font-size="12" fill="#475569" text-anchor="middle">has complied with the standard rules, marine safety requirements, emergency oxygen,</text>
    <text x="400" y="650" font-size="12" fill="#475569" text-anchor="middle">certified divemaster ratio regulations, and boat inspection criteria set forth by the</text>
    <text x="400" y="670" font-size="13" font-weight="bold" fill="#065f46" text-anchor="middle">Philippine Commission on Sports Scuba Diving (PCSSD)</text>

    <rect x="180" y="695" width="440" height="24" rx="4" fill="#d1fae5"/>
    <text x="400" y="711" font-size="11" font-weight="bold" fill="#047857" text-anchor="middle">COMPLIANT WITH REPUBLIC ACT NO. 9593 &amp; PCSSD CIR 2024-01</text>
  </g>

  <g font-family="Arial, sans-serif">
    <line x1="140" y1="910" x2="340" y2="910" stroke="#0f172a" stroke-width="1.5"/>
    <text x="240" y="930" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">COMM. ROBERTO V. TAN</text>
    <text x="240" y="945" font-size="10" fill="#64748b" text-anchor="middle">Executive Director, PCSSD</text>

    <line x1="460" y1="910" x2="660" y2="910" stroke="#0f172a" stroke-width="1.5"/>
    <text x="560" y="930" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">SEC. MARIA ESPERANZA FRASCO</text>
    <text x="560" y="945" font-size="10" fill="#64748b" text-anchor="middle">Secretary, Department of Tourism</text>

    <g transform="translate(345, 840)">
      <circle cx="55" cy="55" r="45" fill="none" stroke="#059669" stroke-width="3"/>
      <circle cx="55" cy="55" r="40" fill="none" stroke="#059669" stroke-width="1" stroke-dasharray="3 2"/>
      <text x="55" y="48" font-size="9" font-weight="bold" fill="#059669" text-anchor="middle">PCSSD ACCREDITED</text>
      <text x="55" y="62" font-size="13" font-weight="bold" fill="#059669" text-anchor="middle">CLASS A</text>
      <text x="55" y="74" font-size="8" fill="#059669" text-anchor="middle">VALID 2026-2027</text>
    </g>
  </g>
</svg>`;

const DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050">
  <defs>
    <linearGradient id="dotBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#faf5ff"/>
      <stop offset="100%" stop-color="#f3e8ff"/>
    </linearGradient>
    <linearGradient id="dotBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7e22ce"/>
      <stop offset="50%" stop-color="#9333ea"/>
      <stop offset="100%" stop-color="#6b21a8"/>
    </linearGradient>
  </defs>

  <rect x="20" y="20" width="760" height="1010" rx="8" fill="url(#dotBg)" stroke="url(#dotBorder)" stroke-width="8"/>
  <rect x="36" y="36" width="728" height="978" rx="4" fill="none" stroke="#9333ea" stroke-width="2" stroke-dasharray="8 4"/>

  <g text-anchor="middle" font-family="Georgia, serif">
    <text x="400" y="90" font-size="13" fill="#666" letter-spacing="2">REPUBLIC OF THE PHILIPPINES</text>
    <text x="400" y="115" font-size="18" font-weight="bold" fill="#581c87" letter-spacing="2">DEPARTMENT OF TOURISM</text>
    <text x="400" y="138" font-size="14" fill="#6b21a8" letter-spacing="1">REGIONAL OFFICE IV-A (CALABARZON)</text>
    <text x="400" y="160" font-size="11" font-style="italic" fill="#7e22ce">Office of Tourism Standards and Regulation</text>

    <circle cx="400" cy="225" r="36" fill="#7e22ce" opacity="0.1"/>
    <circle cx="400" cy="225" r="32" fill="none" stroke="#7e22ce" stroke-width="2"/>
    <text x="400" y="235" font-size="26" text-anchor="middle">🏛️</text>

    <text x="400" y="315" font-size="28" font-weight="bold" fill="#581c87" letter-spacing="3">ACCREDITATION CERTIFICATE</text>
    <text x="400" y="342" font-size="15" font-weight="bold" fill="#7e22ce" letter-spacing="2">PRIMARY TOURISM ENTERPRISE (PTE)</text>
    <line x1="220" y1="355" x2="580" y2="355" stroke="#9333ea" stroke-width="2"/>
  </g>

  <g font-family="Arial, sans-serif" fill="#222">
    <rect x="80" y="380" width="640" height="80" rx="6" fill="#ffffff" stroke="#e9d5ff" stroke-width="1.5"/>
    <text x="105" y="410" font-size="11" fill="#7e22ce" font-weight="bold">DOT ACCREDITATION NO.</text>
    <text x="105" y="442" font-size="20" font-weight="bold" fill="#581c87" font-family="'Courier New', monospace">DOT-R4A-DVE-2026-0045</text>

    <text x="420" y="410" font-size="11" fill="#7e22ce" font-weight="bold">VALID UNTIL</text>
    <text x="420" y="442" font-size="14" font-weight="bold" fill="#0f172a">January 31, 2028</text>

    <rect x="80" y="480" width="640" height="240" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>

    <text x="400" y="520" font-size="12" fill="#64748b" text-anchor="middle">This is to certify that</text>
    <text x="400" y="555" font-size="22" font-weight="bold" fill="#581c87" text-anchor="middle">DEEP BLUE CHARTERS &amp; RESORT</text>
    <text x="400" y="585" font-size="13" fill="#334155" text-anchor="middle">Located at San Teodoro, Mabini, Batangas, Philippines</text>

    <text x="400" y="630" font-size="12" fill="#475569" text-anchor="middle">has met the progressive accreditation standards of the Department of Tourism</text>
    <text x="400" y="650" font-size="12" fill="#475569" text-anchor="middle">and is hereby recognized as an Accredited Ecotourism Scuba Diving Enterprise.</text>

    <rect x="220" y="685" width="360" height="24" rx="4" fill="#f3e8ff"/>
    <text x="400" y="701" font-size="11" font-weight="bold" fill="#7e22ce" text-anchor="middle">CATEGORY: ECO-DIVE OPERATOR / RESORT</text>
  </g>

  <g font-family="Arial, sans-serif">
    <line x1="140" y1="910" x2="340" y2="910" stroke="#0f172a" stroke-width="1.5"/>
    <text x="240" y="930" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">DIR. MARITES C. CASTRO</text>
    <text x="240" y="945" font-size="10" fill="#64748b" text-anchor="middle">Regional Director, DOT Region IV-A</text>

    <line x1="460" y1="910" x2="660" y2="910" stroke="#0f172a" stroke-width="1.5"/>
    <text x="560" y="930" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">ATTY. VERNA ESMERALDA B. BUENSUCESO</text>
    <text x="560" y="945" font-size="10" fill="#64748b" text-anchor="middle">Undersecretary, Tourism Regulation</text>

    <g transform="translate(345, 840)">
      <circle cx="55" cy="55" r="45" fill="none" stroke="#7e22ce" stroke-width="3"/>
      <circle cx="55" cy="55" r="40" fill="none" stroke="#7e22ce" stroke-width="1" stroke-dasharray="4 2"/>
      <text x="55" y="48" font-size="8" font-weight="bold" fill="#7e22ce" text-anchor="middle">DOT ACCREDITED</text>
      <text x="55" y="62" font-size="13" font-weight="bold" fill="#7e22ce" text-anchor="middle">EXCELLENCE</text>
      <text x="55" y="74" font-size="8" fill="#7e22ce" text-anchor="middle">SERIES 2026</text>
    </g>
  </g>
</svg>`;

const C_CARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="850" height="540">
  <defs>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="60%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>

  <rect x="10" y="10" width="830" height="520" rx="24" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="3"/>

  <g transform="translate(40, 40)">
    <circle cx="35" cy="35" r="30" fill="url(#goldGrad)"/>
    <text x="35" y="44" font-size="28" text-anchor="middle">🌊</text>
    <text x="85" y="32" font-family="'Arial Black', sans-serif" font-size="24" font-weight="bold" fill="#ffffff" letter-spacing="2">PROFESSIONAL DIVER</text>
    <text x="85" y="52" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#38bdf8" letter-spacing="3">INSTRUCTOR / DIVEMASTER CERTIFICATION</text>
  </g>

  <g transform="translate(680, 40)">
    <rect x="0" y="0" width="130" height="40" rx="8" fill="#ffffff" opacity="0.1"/>
    <rect x="0" y="0" width="130" height="40" rx="8" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="65" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="2">PRO DIVER</text>
  </g>

  <g transform="translate(40, 130)">
    <rect x="0" y="0" width="180" height="230" rx="12" fill="#334155" stroke="#64748b" stroke-width="2"/>
    <circle cx="90" cy="85" r="45" fill="#475569"/>
    <text x="90" y="98" font-size="42" text-anchor="middle">🤿</text>
    <path d="M 30,200 C 30,150 150,150 150,200 Z" fill="#475569"/>
    <rect x="15" y="195" width="150" height="24" rx="4" fill="#0284c7"/>
    <text x="90" y="211" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">LICENSED PRO</text>
  </g>

  <g transform="translate(250, 130)" font-family="Arial, sans-serif">
    <text x="0" y="20" font-size="11" font-weight="bold" fill="#94a3b8" letter-spacing="1">DIVER FULL NAME</text>
    <text x="0" y="48" font-size="24" font-weight="bold" fill="#ffffff">CARLOS MENDOZA</text>

    <text x="0" y="90" font-size="11" font-weight="bold" fill="#94a3b8" letter-spacing="1">CERTIFICATION LEVEL</text>
    <text x="0" y="116" font-size="18" font-weight="bold" fill="url(#goldGrad)">MASTER SCUBA DIVER TRAINER (MSDT)</text>

    <text x="0" y="155" font-size="11" font-weight="bold" fill="#94a3b8" letter-spacing="1">LICENSE / INSTRUCTOR NO.</text>
    <text x="0" y="180" font-size="17" font-weight="bold" fill="#38bdf8" font-family="'Courier New', monospace">PADI-MSDT-482910</text>

    <g transform="translate(340, 75)">
      <text x="0" y="15" font-size="11" font-weight="bold" fill="#94a3b8" letter-spacing="1">CERT DATE</text>
      <text x="0" y="41" font-size="15" font-weight="bold" fill="#ffffff">2021-04-12</text>

      <text x="0" y="80" font-size="11" font-weight="bold" fill="#94a3b8" letter-spacing="1">RENEWAL EXPIRY</text>
      <text x="0" y="105" font-size="15" font-weight="bold" fill="#4ade80">2027-12-31</text>
    </g>
  </g>

  <g transform="translate(40, 400)">
    <rect x="0" y="0" width="770" height="95" rx="12" fill="#0f172a" opacity="0.6"/>
    <rect x="0" y="0" width="770" height="95" rx="12" fill="none" stroke="#334155" stroke-width="1.5"/>

    <g transform="translate(20, 20)" font-family="Arial, sans-serif">
      <text x="0" y="15" font-size="10" font-weight="bold" fill="#94a3b8">PRIMARY AFFILIATED DIVE CENTER</text>
      <text x="0" y="38" font-size="14" font-weight="bold" fill="#ffffff">Deep Blue Charters &amp; Resort (Mabini, Batangas)</text>

      <text x="450" y="15" font-size="10" font-weight="bold" fill="#94a3b8">MUNICIPAL TO CLEARANCE</text>
      <text x="450" y="38" font-size="13" font-weight="bold" fill="#38bdf8">MAB-TO-PRO-2026-042</text>
    </g>
  </g>
</svg>`;

export const MOCK_BUSINESS_PERMIT_URL = `data:image/svg+xml;utf8,${encodeURIComponent(BUSINESS_PERMIT_SVG)}`;
export const MOCK_PCSSD_URL = `data:image/svg+xml;utf8,${encodeURIComponent(PCSSD_SVG)}`;
export const MOCK_DOT_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DOT_SVG)}`;
export const MOCK_C_CARD_URL = `data:image/svg+xml;utf8,${encodeURIComponent(C_CARD_SVG)}`;
