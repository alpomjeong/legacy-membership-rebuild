import {
  codeFormToDto, missionaryFormToDto, itemFormToDto, staffFormToDto,
  accountCreateToDto, accountEditToDto, emptyCodeForm, emptyStaffForm,
} from "./admin-forms";

describe("codeFormToDto", () => {
  it("required + numeric sortOrder + bool, omits empty", () => {
    expect(codeFormToDto({ ...emptyCodeForm, groupCode: "G", code: "C", name: " 명 ", sortOrder: "3", isActive: true }))
      .toEqual({ groupCode: "G", code: "C", name: "명", sortOrder: 3, isActive: true });
  });
  it("omits empty sortOrder/shortName", () => {
    expect(codeFormToDto({ ...emptyCodeForm, groupCode: "G", code: "C", name: "명", isActive: false }))
      .toEqual({ groupCode: "G", code: "C", name: "명", isActive: false });
  });
});

describe("missionaryFormToDto", () => {
  it("name required, omits empty, keeps isActive", () => {
    expect(missionaryFormToDto({ name: "홍", phone: "", address: " 서울 ", addressDetail: "", isActive: true }))
      .toEqual({ name: "홍", address: "서울", isActive: true });
  });
});

describe("itemFormToDto", () => {
  it("name + numeric-string amount(digits) , omits empty", () => {
    expect(itemFormToDto({ name: "위패", serviceTypeCode: "TABLET", referenceAmount: "₩50,000", description: "", isActive: true }))
      .toEqual({ name: "위패", serviceTypeCode: "TABLET", referenceAmount: "50000", isActive: true });
  });
});

describe("staffFormToDto", () => {
  it("required name; dates/codes omitted when empty, included when set", () => {
    expect(staffFormToDto({ ...emptyStaffForm, staffNameKo: "김", isWorking: true }))
      .toEqual({ staffNameKo: "김", isWorking: true, smsReceiveYn: false });
    expect(staffFormToDto({ ...emptyStaffForm, staffNameKo: "김", joinDate: "2020-01-02", isWorking: true }))
      .toEqual({ staffNameKo: "김", joinDate: "2020-01-02", isWorking: true, smsReceiveYn: false });
  });
  it("smsReceiveYn always sent including true case", () => {
    expect(staffFormToDto({ ...emptyStaffForm, staffNameKo: "김", isWorking: true, smsReceiveYn: true }))
      .toEqual({ staffNameKo: "김", isWorking: true, smsReceiveYn: true });
  });
});

describe("account dtos", () => {
  it("create requires loginId + roleIds, staffId optional", () => {
    expect(accountCreateToDto({ loginId: "u", staffId: "", roleIds: ["1", "2"] }))
      .toEqual({ loginId: "u", roleIds: ["1", "2"] });
    expect(accountCreateToDto({ loginId: "u", staffId: "5", roleIds: ["1"] }))
      .toEqual({ loginId: "u", staffId: "5", roleIds: ["1"] });
  });
  it("edit sends isActive + roleIds", () => {
    expect(accountEditToDto({ isActive: false, roleIds: ["3"] })).toEqual({ isActive: false, roleIds: ["3"] });
  });
});
