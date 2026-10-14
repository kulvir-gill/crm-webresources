export class Account {
  declare watch: (_name: string, _callback: () => void, _fireOnLoad?: boolean) => void;
  declare value: (_name: string) => unknown;
  declare attr: (_name: string) => { setValue(_value: string): void } | null;
  declare notify: (_name: string, _message: string) => void;
  declare clearNotify: (_name: string) => void;
  declare setVisible: (_names: string[], _visible: boolean) => void;

  onLoad(_ctx: Xrm.Events.LoadEventContext): void {
    this.watch("telephone1", () => this.validatePhone(), true);
    this.watch("creditonhold", () => this.toggleCredit(), true);
  }

  onSave(_ctx: Xrm.Events.SaveEventContext): void {
    const name = this.value("name");
    if (typeof name === "string" && name !== name.trim()) {
      this.attr("name")?.setValue(name.trim());
    }
  }

  validatePhone(): void {
    const value = this.value("telephone1");
    if (typeof value === "string" && value && !/^[\d\s()+-]{7,}$/.test(value)) {
      this.notify("telephone1", "Invalid phone number");
    } else {
      this.clearNotify("telephone1");
    }
  }

  toggleCredit(): void {
    const onHold = this.value("creditonhold") === true;
    this.setVisible(["creditlimit"], !onHold);
  }
}

export default Account;
