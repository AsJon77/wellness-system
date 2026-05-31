export type MassagePackage = {
  code: string;
  label: string;
  durationMinutes: number | null;
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
