export const logSection = (title: string) => {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
};

export const logSubSection = (title: string) => {
  console.log("\n" + "-".repeat(60));
  console.log(`  ${title}`);
  console.log("-".repeat(60));
};

export const logSuccess = (message: string) => {
  console.log("SUCCESS! ", message);
};

export const logInfo = (label: string, data?: any) => {
  if (data !== undefined) {
    console.log(`INFO   ${label}:`, data);
  } else {
    console.log(`INFO   ${label}`);
  }
};

export const logAction = (message: string) => {
  console.log("ACTION", message);
};

export const logError = (message: string, error?: any) => {
  console.error("❌ ERROR:", message);
  if (error) console.error(error);
};
