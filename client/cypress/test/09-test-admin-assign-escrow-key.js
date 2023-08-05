describe("key escrow assignment and revocation", () => {
  it("should assign escrow key to Admin 2", () => {
    cy.login_admin();

    for (let i = 0; i < 2; i++) {
      cy.visit("/admin/users");

      const user = { name: "Admin2" };
      const path = `form:contains("${user.name}")`;

      cy.get(path).within(() => {
        cy.contains("button", "Edit").click();
      });

      // Toggle key escrow
      cy.get("[data-ng-model='user.escrow']").click();
      cy.get("[data-ng-model='secret']").type(Cypress.env("user_password"));
      cy.contains("button", "Confirm").click();

      // Add a guard to wait for the "Edit" button to become available again
      cy.wait(1500); // Adjust the delay time as needed

      // Go back to the user list page for the next iteration
      cy.go("back");
    }

    cy.logout();
  });
});
