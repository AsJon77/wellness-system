export type MassagePackage = {
  code: string;
  label: string;
  durationMinutes: number | null;
};

export type MassagePackageChoice = {
  code: string;
  label: string;
  rm: number;
  coupon: number;
  oil?: number;
};

export type MassagePackageSelectionGroup = {
  title: string;
  background: string;
  columns: MassagePackageChoice[][];
};

const durations = [60, 90, 120];

const packageGroups = [
  { prefix: "F", name: "Foot massage" },
  { prefix: "FS", name: "Foot and shoulder" },
  { prefix: "BD", name: "Body massage" },
  { prefix: "HS", name: "Head and shoulder" },
];

export const massagePackages: MassagePackage[] = [
  {
    code: "OFF",
    label: "OFF - Therapist off day",
    durationMinutes: null,
  },
  {
    code: "MC",
    label: "MC - Medical leave",
    durationMinutes: null,
  },
  {
    code: "F30",
    label: "F30 - Foot massage 30 mins",
    durationMinutes: 30,
  },
  {
    code: "HS30",
    label: "HS30 - Head and shoulder 30 mins",
    durationMinutes: 30,
  },
  ...packageGroups.flatMap(({ prefix, name }) =>
    durations.flatMap((durationMinutes) => [
      {
        code: `${prefix}${durationMinutes}`,
        label: `${prefix}${durationMinutes} - ${name} ${durationMinutes} mins`,
        durationMinutes,
      },
      ...(prefix === "BD" && durationMinutes === 120
        ? [
            {
              code: "F60BD60",
              label: "F60BD60 - Foot 60 mins + body 60 mins",
              durationMinutes: 120,
            },
          ]
        : []),
    ]),
  ),
];

export const massagePackageOptions = massagePackages.map((item) => ({
  label: item.label,
  value: item.code,
}));

export const massagePackageSelectionGroups: MassagePackageSelectionGroup[] = [
  {
    title: "HAPPY HOUR",
    background: "rgb(249, 251, 239)",
    columns: [
      [
        { code: "F60", label: "Foot massage 60 mins", rm: 46, coupon: 13 },
        { code: "F90", label: "Foot massage 90 mins", rm: 71, coupon: 14 },
      ],
      [
        {
          code: "FS60",
          label: "Foot and shoulder 60 mins",
          rm: 55,
          coupon: 13,
        },
        {
          code: "FS90",
          label: "Foot and shoulder 90 mins",
          rm: 81,
          coupon: 14,
        },
      ],
      [
        { code: "BD60", label: "Body massage 60 mins", rm: 61, coupon: 17 },
        { code: "BD90", label: "Body massage 90 mins", rm: 95, coupon: 14 },
      ],
      [
        {
          code: "HS20",
          label: "Head and shoulder 20 mins",
          rm: 0,
          coupon: 11.9,
        },
        {
          code: "HS60",
          label: "Head and shoulder 60 mins",
          rm: 61,
          coupon: 17,
        },
        {
          code: "HS90",
          label: "Head and shoulder 90 mins",
          rm: 95,
          coupon: 14,
        },
      ],
    ],
  },
  {
    title: "NORMAL PRICE",
    background: "#dbeafe",
    columns: [
      [
        { code: "F30", label: "Foot massage 30 mins", rm: 35, coupon: 20 },
        { code: "F60", label: "Foot massage 60 mins", rm: 55, coupon: 23 },
        { code: "F90", label: "Foot massage 90 mins", rm: 86, coupon: 18 },
        { code: "F120", label: "Foot massage 120 mins", rm: 103, coupon: 25 },
      ],
      [
        {
          code: "FS60",
          label: "Foot and shoulder 60 mins",
          rm: 61,
          coupon: 21,
        },
        {
          code: "FS90",
          label: "Foot and shoulder 90 mins",
          rm: 87,
          coupon: 24,
        },
        {
          code: "FS120",
          label: "Foot and shoulder 120 mins",
          rm: 123,
          coupon: 15,
        },
      ],
      [
        { code: "BD60", label: "Body massage 60 mins", rm: 67, coupon: 23 },
        { code: "BD90", label: "Body massage 90 mins", rm: 97, coupon: 22 },
        { code: "BD120", label: "Body massage 120 mins", rm: 126, coupon: 23 },
        { code: "BD150", label: "Body massage 150 mins", rm: 151, coupon: 30 },
      ],
      [
        {
          code: "HS30",
          label: "Head and shoulder 30 mins",
          rm: 37,
          coupon: 21,
        },
        {
          code: "HS60",
          label: "Head and shoulder 60 mins",
          rm: 65,
          coupon: 23,
        },
        {
          code: "HS90",
          label: "Head and shoulder 90 mins",
          rm: 97,
          coupon: 31,
        },
        { code: "BD180", label: "Body massage 180 mins", rm: 193, coupon: 45 },
      ],
    ],
  },
  {
    title: "MTHLY PROMO",
    background: "#fff1f2",
    columns: [
      [
        { code: "F120", label: "Foot massage 120 mins", rm: 103, coupon: 25 },
        {
          code: "FS120",
          label: "Foot and shoulder 120 mins",
          rm: 123,
          coupon: 15,
        },
        {
          code: "F60BD60",
          label: "Foot 60 mins + body 60 mins",
          rm: 122,
          coupon: 26,
        },
        { code: "BD120", label: "Body massage 120 mins", rm: 126, coupon: 23 },
      ],
    ],
  },
];

export const getMassagePackageDuration = (code: string) => {
  const upperCode = code.trim().toUpperCase();
  const savedPackageDuration = massagePackages.find(
    (item) => item.code === upperCode,
  )?.durationMinutes;

  if (savedPackageDuration !== undefined) {
    return savedPackageDuration;
  }

  const customDuration = Number(upperCode.match(/(\d+)$/)?.[1]);

  return customDuration > 0 ? customDuration : null;
};
