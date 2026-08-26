import type { TenantKey } from './types';

export interface TenantMeta {
  key: TenantKey;
  /** 백엔드가 x-tenant-id 로 받는 값 (k6 스크립트와 동일) */
  tenantId: string;
  /** 콘솔에 뜨는 브랜드 표시명. key/tenantId 는 백엔드 계약이라 건드리지 않는다 */
  label: string;
  storeName: string;
  posId: string;
  memberId: string;
  memberName: string;
  grade: string;
  /** 콘솔 차트용 계열 색 — 상태색(빨강)과 겹치면 안 되므로 건드리지 말 것 */
  color: string;
  /** POS 화면에서 쓰는 매장 브랜드 색 */
  brandColor: string;
  /** POS 헤더 로고 이미지. public/ 에 파일을 넣고 '/파일명' 으로 적으면 됨. 없으면 기본 도형 */
  logo?: string;
  /** 실측 baseline RPS — k6/c5_scenario_5a.js 기준 */
  baselineRps: number;
  /** 목업 모드에서 쓰는 시작 잔액 */
  seedBalance: number;
  /** 키오스크 메뉴판 */
  menu: { id: string; name: string; price: number }[];
  earnRate: number;
}

export const TENANTS: Record<TenantKey, TenantMeta> = {
  cgv: {
    key: 'cgv',
    tenantId: 'cgv',
    label: 'CJ ONSTYLE',
    storeName: 'CGV 송도타임스페이스점',
    posId: 'POS-CGV-0317',
    memberId: 'm-1001',
    seedBalance: 12480,
    memberName: '김*현',
    grade: 'VIP',
    color: 'var(--t-cgv)',
    brandColor: '#ED1C24',
    logo: '/cgv_logo.png',
    baselineRps: 360,
    menu: [
      { id: 'movie-2d', name: '일반영화', price: 14000 },
      { id: 'movie-imax', name: 'IMAX', price: 21000 },
      { id: 'movie-4dx', name: '4DX', price: 24000 },
      { id: 'set-s', name: '스몰 세트 (팝콘M1 + 탄산M1)', price: 8000 },
      { id: 'combo-cgv', name: 'CGV 콤보 (팝콘L1 + 탄산M2)', price: 12000 },
      { id: 'combo-l', name: '라지 콤보 (팝콘L2 + 탄산L2)', price: 17000 },
    ],
    earnRate: 0.05,
  },
  cjenm: {
    key: 'cjenm',
    tenantId: 'cjenm',
    label: '뚜레쥬르',
    storeName: 'CJ ENM 커머스',
    posId: 'POS-ENM-0042',
    memberId: 'm-2001',
    seedBalance: 3210,
    memberName: '박*수',
    grade: 'GOLD',
    color: 'var(--t-cjenm)',
    brandColor: '#EB6834',
    logo: undefined, // 예: '/logo-cjenm.png'
    baselineRps: 240,
    menu: [
      { id: 'knit', name: '가을 니트', price: 32000 },
      { id: 'padding', name: '겨울 패딩', price: 129000 },
      { id: 'sneakers', name: '스니커즈', price: 59000 },
      { id: 'shipping', name: '배송비', price: 3000 },
    ],
    earnRate: 0.01,
  },
  oliveyoung: {
    key: 'oliveyoung',
    tenantId: 'oliveyoung',
    label: 'CJ 대한통운',
    storeName: '올리브영 명동타운점',
    posId: 'POS-OY-1128',
    memberId: 'm-4001',
    seedBalance: 8940,
    memberName: '이*현',
    grade: 'VIP',
    color: 'var(--t-oliveyoung)',
    brandColor: '#1BAF7A',
    logo: '/olive_logo.png',
    baselineRps: 480,
    menu: [
      { id: 'ampoule', name: '[1등미백앰플] 메디큐브 PDRN 핑크 펩타이드 앰플 30ml 리필기획(+리필팩50ml+거울키링)', price: 24600 },
      { id: 'skinpad', name: '[8/25 하루특가/업그레이드 리뉴얼] 메디힐 더마 패드 200매 대용량 기획 세트 7종', price: 28400 },
      { id: 'brush', name: '[베스트구성] 필리밀리 브러시 세트 골라담기', price: 14000 },
      { id: 'shake', name: '[8월올영픽] 딜라이트 프로젝트 단백질쉐이크 45g', price: 3900 },
      { id: 'eyeliner', name: '[1+1기획] 웨이크메이크 철벽 펜 아이라이너 3COLOR', price: 9900 },
      { id: 'serum', name: '[8월올영픽/3일진정세럼] 브링그린 징크테카 트러블 세럼 대용량 기획', price: 26600 },
    ],
    earnRate: 0.01,
  },
  vips: {
    key: 'vips',
    tenantId: 'vips',
    label: 'VIPS',
    storeName: 'VIPS 센텀시티점',
    posId: 'POS-VIPS-0206',
    memberId: 'm-3001',
    seedBalance: 1150,
    memberName: '최*원',
    grade: 'SILVER',
    color: 'var(--t-vips)',
    brandColor: '#EDA100',
    logo: undefined, // 예: '/logo-vips.png'
    baselineRps: 120,
    menu: [
      { id: 'adult', name: '샐러드바 성인', price: 29900 },
      { id: 'child', name: '샐러드바 소인', price: 17900 },
      { id: 'steak', name: '스테이크 추가', price: 12900 },
      { id: 'drink', name: '음료 리필', price: 4200 },
    ],
    earnRate: 0.01,
  },
};

export const TENANT_ORDER: TenantKey[] = ['cgv', 'cjenm', 'oliveyoung', 'vips'];

export function isTenantKey(v: string | null): v is TenantKey {
  return !!v && v in TENANTS;
}
