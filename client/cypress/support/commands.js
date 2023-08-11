import '@cypress/code-coverage/support';

Cypress.Commands.add("vars", () => {
  return {
    init_password: "Password12345#",
    field_types: [
      "Single-line text input",
      "Multi-line text input",
      "Selection box",
      "Multiple choice input",
      "Checkbox",
      "Attachment",
      "Terms of service",
      "Date",
      "Date range",
      "Voice",
      "Group of questions",
    ],
  };
});

Cypress.Commands.add("takeScreenshot", (filename, locator) => {
  if (!Cypress.env('takeScreenshots')) {
    return;
  }

  cy.document().then((doc) => {
    const height = doc.body.scrollHeight;
    cy.viewport(1280, height);
  });

  cy.screenshot(filename,{
    overwrite: true
  });
});

Cypress.Commands.add("waitForUrl", (url, timeout) => {
  const t = timeout === undefined ? Cypress.config().defaultCommandTimeout : timeout;
  return cy.url().should("include", url, { timeout: t });
});

Cypress.Commands.add("login_admin", (username, password, url, firstlogin) => {
  username = username === undefined ? "admin" : username;
  password = password === undefined ? Cypress.env("user_password") : password;
  url = url === undefined ? "login" : url;

  let finalURL = "";

  cy.visit(url);
  cy.waitForUrl(url);

  cy.get('[name="username"]').type(username);
  cy.get('[name="password"]').type(password);
  cy.get("#login-button").click();

  if (firstlogin) {
    finalURL = "/actions/forcedpasswordchange";
    cy.waitForUrl(finalURL);
  } else {
    cy.url().should("include", "/login").then(() => {
      cy.url().should("not.include", "/login").then((currentURL) => {
        const hashPart = currentURL.split("#")[1];
        finalURL = hashPart === "login" ? "/admin/home" : hashPart;
        cy.waitForUrl(finalURL);
      });
    });
  }
});

Cypress.Commands.add("login_receiver", (username, password, url, firstlogin) => {
  username = username === undefined ? "Recipient" : username;
  password = password === undefined ? Cypress.env("user_password") : password;
  url = url === undefined ? "/login" : url;

  cy.visit(url);
  cy.get('[data-ng-model="Authentication.loginData.loginUsername"]').type(username);
  cy.get('[data-ng-model="Authentication.loginData.loginPassword"]').type(password);
  cy.get("#login-button").click();

  if (firstlogin) {
    url = "/actions/forcedpasswordchange";
  } else {
    url = cy.url().then((currentURL) => {
      return currentURL === "/login" ? "/recipient/home" : currentURL;
    });
  }
});

Cypress.Commands.add("login_custodian", (username, password, url, firstlogin) => {
  username = username === undefined ? "Custodian" : username;
  password = password === undefined ? Cypress.env("user_password") : password;
  url = url === undefined ? "/login" : url;

  cy.visit(url);
  cy.get('[data-ng-model="Authentication.loginData.loginUsername"]').type(username);
  cy.get('[data-ng-model="Authentication.loginData.loginPassword"]').type(password);
  cy.get("#login-button").click();

  if (firstlogin) {
    url = "/actions/forcedpasswordchange";
  } else {
    url = cy.url().then((currentURL) => {
      return currentURL === "/login" ? "/recipient/home" : currentURL;
    });
  }
});

Cypress.Commands.add("waitForLoader", () => {
  cy.get('#PageOverlay').should('not.have.class', 'ng-hide');
  cy.get('#PageOverlay.ng-hide');
});

Cypress.Commands.add("logout", () => {
  cy.waitUntilClickable("#LogoutLink");
});




















Cypress.Commands.add("browserTimeout", () => {
  return 30000;
});

Cypress.Commands.add("waitUntilPresent", (locator, timeout) => {
  const t = timeout === undefined ? Cypress.config().defaultCommandTimeout : timeout;
  return cy.get(locator).should("be.visible", { timeout: t });
});

Cypress.Commands.add("waitUntilAbsent", (locator, timeout) => {
  const t = timeout === undefined ? Cypress.config().defaultCommandTimeout : timeout;
  return cy.get(locator).should("not.be.visible", { timeout: t });
});

Cypress.Commands.add("waitUntilClickable", (locator, timeout) => {
  const t = timeout === undefined ? Cypress.config().defaultCommandTimeout : timeout;
  return cy.get(locator).click({ timeout: t });
});

Cypress.Commands.add("waitForUrl", (url, timeout) => {
  const t = timeout === undefined ? Cypress.config().defaultCommandTimeout : timeout;
  return cy.url().should("include", url, { timeout: t });
});

Cypress.Commands.add("performSubmission", () => {
  cy.visit("/");
  cy.get("[data-cy=whistleblowing-button]").click();
  cy.get("[data-cy=submission-form]").should("be.visible");
  cy.get("[data-cy=summary]").type("summary");
  cy.get("[data-cy=detail]").type("detail");
  cy.get("[data-cy=step-0-field-2-0-input-0]").type("...");
  cy.get("[data-cy=step-0-field-2-1-input-0]").type("...");
  cy.contains("[data-cy=i-witnessed-facts]").click();
  cy.contains("[data-cy=yes]").click();
  cy.get("[data-cy=step-0-field-6-0-input-0]").type("...");

  cy.fixture("files/evidence-1.pdf").then((fileContent1) => {
    cy.get("[data-cy=step-0-field-5-0-input-0]").attachFile({
      fileContent: fileContent1,
      fileName: "evidence-1.pdf",
      mimeType: "application/pdf",
    });
  });
  cy.fixture("files/evidence-2.zip").then((fileContent2) => {
    cy.get("[data-cy=step-0-field-5-0-input-0]").attachFile({
      fileContent: fileContent2,
      fileName: "evidence-2.zip",
      mimeType: "application/zip",
    });
  });

  cy.contains("[data-cy=no]").click();
  cy.get("[data-cy=step-0-field-10-0-input-0]").type("...");

  cy.get("[data-cy=submit-button]").should("be.visible").click();

  cy.get("[data-cy=receipt-code]").should("be.visible").then(($receiptCode) => {
    const receiptCode = $receiptCode.attr("value");
    cy.screenshot("whistleblower/receipt.png");
    return receiptCode;
  });
});

Cypress.Commands.add("submitFile", (fname) => {
  cy.fixture(`fixtures/files/${fname}`).then((fileContent) => {
    cy.get("[data-cy=file-input]").attachFile({
      fileContent: fileContent,
      fileName: fname,
    });
  });
});

Cypress.Commands.add("waitForPageOverlayToHide", () => {
  cy.get("#PageOverlay", { timeout: 10000 }).should("not.be.visible", { timeout: 10000 });
});

Cypress.Commands.add("makeTestFilePath", (name) => {
  const testDir = Cypress.config("testDir");
  return Cypress._.join([testDir, "files", name], "/");
});

Cypress.Commands.add("login_whistleblower", (receipt) => {
  cy.visit("/#/");
  cy.get('[data-model="formatted_receipt"]').type(receipt);
  cy.screenshot("whistleblower/access.png");
  cy.get("#ReceiptButton").click();
  cy.waitUntilPresent("#TipInfoBox");
});

Cypress.Commands.add("clickFirstDisplayed", (selector) => {
  cy.get(selector).filter(":visible").first().click();
});

Cypress.Commands.add("makeTestFilePath", (name) => {
  const testDir = Cypress.config("testDir");
  return Cypress._.join([testDir, "files", name], "/");
});
