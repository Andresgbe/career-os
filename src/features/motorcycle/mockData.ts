import type {
  MotorcycleInfo,
  OilChange,
  ToBuyItem,
  AuditEntry,
} from "./types";

export const mockInfo: MotorcycleInfo = {
  id: "1",
  make: "",
  model: "",
  year: null,
  plate: "",
  vin: "",
  color: "",
  purchaseDate: null,
  notes: "",
  attachments: [],
};

export const mockOilChanges: OilChange[] = [
  500, 2000, 3500, 5000, 6500, 8000, 9500, 11000, 12000,
].map((km, i) => ({
  id: String(i + 1),
  km,
  done: false,
  date: null,
  receiptUrl: null,
}));

export const mockToBuy: ToBuyItem[] = [
  {
    id: "1",
    name: "Example: chain lubricant",
    referenceUrl: "",
    status: "pending",
  },
];

export const mockAudit: AuditEntry[] = [
  {
    id: "1",
    date: "2026-01-15",
    category: "maintenance",
    description: "Example: greased the chain",
    location: "Home",
  },
];