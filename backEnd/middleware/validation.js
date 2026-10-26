export const ORGANS = [
  "Kidney",
  "Liver",
  "Heart",
  "Lungs",
  "Pancreas",
  "Cornea",
];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export function validateRequest(req, res, next) {
  const visit = (obj) => {
    if (!obj || typeof obj !== "object") return false;
    return Object.entries(obj).some(
      ([key, value]) =>
        key.startsWith("$") ||
        key.includes(".") ||
        key === "__proto__" ||
        key === "constructor" ||
        visit(value),
    );
  };
  if (visit(req.body) || visit(req.query))
    return res.status(400).json({ message: "Invalid request fields" });
  if (
    req.body !== undefined &&
    (req.body === null ||
      Array.isArray(req.body) ||
      typeof req.body !== "object")
  )
    return res.status(400).json({ message: "Send a JSON object" });
  if (req.body && !Array.isArray(req.body) && typeof req.body === "object") {
    for (const key of ["consent", "confirmed", "clinicalApproval"])
      if (req.body[key] !== undefined && typeof req.body[key] !== "boolean")
        return res.status(400).json({ message: `Invalid ${key}` });
    const strings = [
      "reviewNotes",
      "laboratory",
      "reportDate",
      "cancellationReason",
      "withdrawalReason",
      "donationType",
      "email",
      "password",
      "fullName",
      "phone",
      "role",
      "license",
      "organ",
      "bloodGroup",
      "status",
      "date",
      "time",
      "surgeon",
      "recipientId",
      "donorId",
      "pledgeId",
      "allocationId",
      "requestId",
      "hospitalId",
      "recommendationId",
    ];
    for (const key of strings)
      if (
        req.body[key] !== undefined &&
        (typeof req.body[key] !== "string" ||
          req.body[key].length >
            (key === "password"
              ? 128
              : key === "reviewNotes"
                ? 2000
                : ["withdrawalReason", "cancellationReason"].includes(key)
                  ? 1000
                  : 500))
      )
        return res.status(400).json({ message: `Invalid ${key}` });
    if (req.body.organ !== undefined && !ORGANS.includes(req.body.organ))
      return res.status(400).json({ message: "Invalid organ" });
    if (
      req.body.bloodGroup !== undefined &&
      req.body.bloodGroup !== "" &&
      !BLOOD_GROUPS.includes(req.body.bloodGroup)
    )
      return res.status(400).json({ message: "Invalid blood group" });
    for (const [key, value] of Object.entries(req.body))
      if (/Id$/.test(key) && value && !/^[a-f0-9]{24}$/i.test(value))
        return res.status(400).json({ message: `Invalid ${key}` });
  }
  next();
}
export function safeErrors(error, req, res, next) {
  if (process.env.NODE_ENV === "test" && !error.status && error.code !== 11000)
    console.error("TEST ERROR", error.stack);
  if (res.headersSent) return next(error);
  const status =
    error.status ||
    (error.code === 11000
      ? 409
      : ["ValidationError", "CastError", "SyntaxError"].includes(error.name)
        ? 400
        : 500);
  res.status(status).json({
    message:
      status === 500
        ? "Unable to complete the request"
        : error.code === 11000
          ? "This record already exists"
          : error.message,
  });
}
export const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
