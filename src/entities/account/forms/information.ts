import Account from "../account.js";

export default class Information extends Account {
  onLoad(ctx: Xrm.Events.LoadEventContext): void {
    super.onLoad(ctx);
    const form = ctx.getFormContext();
    if (form.ui.getFormType() === 1) {
      const country = form.getAttribute("address1_country");
      if (country) {
        country.setValue("Canada");
      }
    }
    this.onIndustryChange(form);
    this.setAccountTypeReadonly(form);
  }

  private setAccountTypeReadonly(form: Xrm.FormContext): void {
    const formtype = form.ui.getFormType();
    if (formtype === 1) {
      const accountType = form.getAttribute("pphl_accounttype");
      if (accountType) {
        accountType.controls.forEach((control) => control.setDisabled(true));
      }
    }
  }
  onSave(ctx: Xrm.Events.SaveEventContext): void {
    super.onSave(ctx);
    const form = ctx.getFormContext();
    const primaryContact = form.getAttribute("primarycontactid");
    if (!primaryContact || !primaryContact.getValue()) {
      /** @type {Xrm.Controls.StandardControl | null} */
      const control = form.getControl<Xrm.Controls.StandardControl>("primarycontactid");
      if (control) {
        control.setNotification("Primary contact is required on save", "primarycontactid_err");
      }
      ctx.getEventArgs().preventDefault();
    }
  }

  private onIndustryChange(form: Xrm.FormContext): void {
    const industryCode = form.getAttribute("industrycode");
    const visible = Boolean(industryCode && industryCode.getValue() != null);
    ["sic"].forEach((name) => {
      /** @type {Xrm.Controls.StandardControl | null} */
      const control = form.getControl<Xrm.Controls.StandardControl>(name);
      if (control) {
        control.setVisible(visible);
      }
    });
  }
}
