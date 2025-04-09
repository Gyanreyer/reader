/**
 * @template {object} TValue
 */
export class State {
  /**
   * @param {TValue} initialValue
   */
  constructor(initialValue) {
    this._eventTarget = new EventTarget();

    this._idleCallbackID = null;

    this.value = new Proxy(initialValue, {
      set: (target, prop, newValue) => {
        if (Reflect.get(target, prop) === newValue) {
          return false;
        }
        Reflect.set(target, prop, newValue);

        // Use requestIdleCallback to batch updates
        if (this._idleCallbackID !== null) {
          cancelIdleCallback(this._idleCallbackID);
        }
        this._idleCallbackID = requestIdleCallback(() => {
          this._eventTarget.dispatchEvent(new Event("change"));
        });
        return true;
      },
    });
  }

  /**
   * @param {(newValue: TValue) => void} onChangeListener
   * @param {...keyof TValue} filterKeys
   * @returns {() => void} Cleanup function to unsubscribe
   */
  subscribe(onChangeListener, ...filterKeys) {
    const filterKeySet = filterKeys.length > 0 ? new Set(filterKeys) : null;
    /**
     * @param {CustomEvent<keyof TValue>} evt
     */
    const callback = (evt) => {
      if (filterKeySet && !filterKeySet.has(evt.detail)) {
        return;
      }

      onChangeListener(this.value);
    };
    this._eventTarget.addEventListener("change", /** @type {any} */ (callback));
    return () =>
      this._eventTarget.removeEventListener(
        "change",
        /** @type {any} */ (callback)
      );
  }
}
