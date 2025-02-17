// @ts-nocheck
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t = globalThis,
  s =
    t.ShadowRoot &&
    (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) &&
    "adoptedStyleSheets" in Document.prototype &&
    "replace" in CSSStyleSheet.prototype,
  i = Symbol(),
  e = new WeakMap();
class h {
  constructor(t, s, e) {
    if (((this._$cssResult$ = !0), e !== i))
      throw Error(
        "CSSResult is not constructable. Use `unsafeCSS` or `css` instead."
      );
    (this.cssText = t), (this.t = s);
  }
  get styleSheet() {
    let t = this.i;
    const i = this.t;
    if (s && void 0 === t) {
      const s = void 0 !== i && 1 === i.length;
      s && (t = e.get(i)),
        void 0 === t &&
          ((this.i = t = new CSSStyleSheet()).replaceSync(this.cssText),
          s && e.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
}
const o = (t) => new h("string" == typeof t ? t : t + "", void 0, i),
  r = (t, ...s) => {
    const e =
      1 === t.length
        ? t[0]
        : s.reduce(
            (s, i, e) =>
              s +
              ((t) => {
                if (!0 === t._$cssResult$) return t.cssText;
                if ("number" == typeof t) return t;
                throw Error(
                  "Value passed to 'css' function must be a 'css' function result: " +
                    t +
                    ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security."
                );
              })(i) +
              t[e + 1],
            t[0]
          );
    return new h(e, t, i);
  },
  n = (i, e) => {
    if (s)
      i.adoptedStyleSheets = e.map((t) =>
        t instanceof CSSStyleSheet ? t : t.styleSheet
      );
    else
      for (const s of e) {
        const e = document.createElement("style"),
          h = t.litNonce;
        void 0 !== h && e.setAttribute("nonce", h),
          (e.textContent = s.cssText),
          i.appendChild(e);
      }
  },
  c = s
    ? (t) => t
    : (t) =>
        t instanceof CSSStyleSheet
          ? ((t) => {
              let s = "";
              for (const i of t.cssRules) s += i.cssText;
              return o(s);
            })(t)
          : t,
  /**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   */ {
    is: a,
    defineProperty: l,
    getOwnPropertyDescriptor: u,
    getOwnPropertyNames: d,
    getOwnPropertySymbols: f,
    getPrototypeOf: p,
  } = Object,
  v = globalThis,
  m = v.trustedTypes,
  y = m ? m.emptyScript : "",
  g = v.reactiveElementPolyfillSupport,
  _ = (t, s) => t,
  b = {
    toAttribute(t, s) {
      switch (s) {
        case Boolean:
          t = t ? y : null;
          break;
        case Object:
        case Array:
          t = null == t ? t : JSON.stringify(t);
      }
      return t;
    },
    fromAttribute(t, s) {
      let i = t;
      switch (s) {
        case Boolean:
          i = null !== t;
          break;
        case Number:
          i = null === t ? null : Number(t);
          break;
        case Object:
        case Array:
          try {
            i = JSON.parse(t);
          } catch (t) {
            i = null;
          }
      }
      return i;
    },
  },
  S = (t, s) => !a(t, s),
  w = { attribute: !0, type: String, converter: b, reflect: !1, hasChanged: S };
(Symbol.metadata ??= Symbol("metadata")),
  (v.litPropertyMetadata ??= new WeakMap());
class $ extends HTMLElement {
  static addInitializer(t) {
    this.o(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this.u && [...this.u.keys()];
  }
  static createProperty(t, s = w) {
    if (
      (s.state && (s.attribute = !1),
      this.o(),
      this.elementProperties.set(t, s),
      !s.noAccessor)
    ) {
      const i = Symbol(),
        e = this.getPropertyDescriptor(t, i, s);
      void 0 !== e && l(this.prototype, t, e);
    }
  }
  static getPropertyDescriptor(t, s, i) {
    const { get: e, set: h } = u(this.prototype, t) ?? {
      get() {
        return this[s];
      },
      set(t) {
        this[s] = t;
      },
    };
    return {
      get() {
        return e?.call(this);
      },
      set(s) {
        const o = e?.call(this);
        h.call(this, s), this.requestUpdate(t, o, i);
      },
      configurable: !0,
      enumerable: !0,
    };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? w;
  }
  static o() {
    if (this.hasOwnProperty(_("elementProperties"))) return;
    const t = p(this);
    t.finalize(),
      void 0 !== t.l && (this.l = [...t.l]),
      (this.elementProperties = new Map(t.elementProperties));
  }
  static finalize() {
    if (this.hasOwnProperty(_("finalized"))) return;
    if (
      ((this.finalized = !0), this.o(), this.hasOwnProperty(_("properties")))
    ) {
      const t = this.properties,
        s = [...d(t), ...f(t)];
      for (const i of s) this.createProperty(i, t[i]);
    }
    const t = this[Symbol.metadata];
    if (null !== t) {
      const s = litPropertyMetadata.get(t);
      if (void 0 !== s)
        for (const [t, i] of s) this.elementProperties.set(t, i);
    }
    this.u = new Map();
    for (const [t, s] of this.elementProperties) {
      const i = this.p(t, s);
      void 0 !== i && this.u.set(i, t);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const s = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const t of i) s.unshift(c(t));
    } else void 0 !== t && s.push(c(t));
    return s;
  }
  static p(t, s) {
    const i = s.attribute;
    return !1 === i
      ? void 0
      : "string" == typeof i
      ? i
      : "string" == typeof t
      ? t.toLowerCase()
      : void 0;
  }
  constructor() {
    super(),
      (this.v = void 0),
      (this.isUpdatePending = !1),
      (this.hasUpdated = !1),
      (this.m = null),
      this._();
  }
  _() {
    (this.S = new Promise((t) => (this.enableUpdating = t))),
      (this._$AL = new Map()),
      this.$(),
      this.requestUpdate(),
      this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this.P ??= new Set()).add(t),
      void 0 !== this.renderRoot && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this.P?.delete(t);
  }
  $() {
    const t = new Map(),
      s = this.constructor.elementProperties;
    for (const i of s.keys())
      this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this.v = t);
  }
  createRenderRoot() {
    const t =
      this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return n(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    (this.renderRoot ??= this.createRenderRoot()),
      this.enableUpdating(!0),
      this.P?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {}
  disconnectedCallback() {
    this.P?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, s, i) {
    this._$AK(t, i);
  }
  C(t, s) {
    const i = this.constructor.elementProperties.get(t),
      e = this.constructor.p(t, i);
    if (void 0 !== e && !0 === i.reflect) {
      const h = (
        void 0 !== i.converter?.toAttribute ? i.converter : b
      ).toAttribute(s, i.type);
      (this.m = t),
        null == h ? this.removeAttribute(e) : this.setAttribute(e, h),
        (this.m = null);
    }
  }
  _$AK(t, s) {
    const i = this.constructor,
      e = i.u.get(t);
    if (void 0 !== e && this.m !== e) {
      const t = i.getPropertyOptions(e),
        h =
          "function" == typeof t.converter
            ? { fromAttribute: t.converter }
            : void 0 !== t.converter?.fromAttribute
            ? t.converter
            : b;
      (this.m = e), (this[e] = h.fromAttribute(s, t.type)), (this.m = null);
    }
  }
  requestUpdate(t, s, i) {
    if (void 0 !== t) {
      if (
        ((i ??= this.constructor.getPropertyOptions(t)),
        !(i.hasChanged ?? S)(this[t], s))
      )
        return;
      this.T(t, s, i);
    }
    !1 === this.isUpdatePending && (this.S = this.M());
  }
  T(t, s, i) {
    this._$AL.has(t) || this._$AL.set(t, s),
      !0 === i.reflect && this.m !== t && (this.k ??= new Set()).add(t);
  }
  async M() {
    this.isUpdatePending = !0;
    try {
      await this.S;
    } catch (t) {
      Promise.reject(t);
    }
    const t = this.scheduleUpdate();
    return null != t && (await t), !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (((this.renderRoot ??= this.createRenderRoot()), this.v)) {
        for (const [t, s] of this.v) this[t] = s;
        this.v = void 0;
      }
      const t = this.constructor.elementProperties;
      if (t.size > 0)
        for (const [s, i] of t)
          !0 !== i.wrapped ||
            this._$AL.has(s) ||
            void 0 === this[s] ||
            this.T(s, this[s], i);
    }
    let t = !1;
    const s = this._$AL;
    try {
      (t = this.shouldUpdate(s)),
        t
          ? (this.willUpdate(s),
            this.P?.forEach((t) => t.hostUpdate?.()),
            this.update(s))
          : this.A();
    } catch (s) {
      throw ((t = !1), this.A(), s);
    }
    t && this._$AE(s);
  }
  willUpdate(t) {}
  _$AE(t) {
    this.P?.forEach((t) => t.hostUpdated?.()),
      this.hasUpdated || ((this.hasUpdated = !0), this.firstUpdated(t)),
      this.updated(t);
  }
  A() {
    (this._$AL = new Map()), (this.isUpdatePending = !1);
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this.S;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    (this.k &&= this.k.forEach((t) => this.C(t, this[t]))), this.A();
  }
  updated(t) {}
  firstUpdated(t) {}
}
($.elementStyles = []),
  ($.shadowRootOptions = { mode: "open" }),
  ($[_("elementProperties")] = new Map()),
  ($[_("finalized")] = new Map()),
  g?.({ ReactiveElement: $ }),
  (v.reactiveElementVersions ??= []).push("2.0.4");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const P = globalThis,
  C = P.trustedTypes,
  T = C ? C.createPolicy("lit-html", { createHTML: (t) => t }) : void 0,
  x = "$lit$",
  M = `lit$${Math.random().toFixed(9).slice(2)}$`,
  k = "?" + M,
  A = `<${k}>`,
  E = document,
  U = () => E.createComment(""),
  N = (t) => null === t || ("object" != typeof t && "function" != typeof t),
  O = Array.isArray,
  R = (t) => O(t) || "function" == typeof t?.[Symbol.iterator],
  z = "[ \t\n\f\r]",
  V = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,
  L = /-->/g,
  I = />/g,
  j = RegExp(
    `>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,
    "g"
  ),
  D = /'/g,
  H = /"/g,
  B = /^(?:script|style|textarea|title)$/i,
  W =
    (t) =>
    (s, ...i) => ({ _$litType$: t, strings: s, values: i }),
  q = W(1),
  J = W(2),
  Z = W(3),
  F = Symbol.for("lit-noChange"),
  G = Symbol.for("lit-nothing"),
  K = new WeakMap(),
  Q = E.createTreeWalker(E, 129);
function X(t, s) {
  if (!O(t) || !t.hasOwnProperty("raw"))
    throw Error("invalid template strings array");
  return void 0 !== T ? T.createHTML(s) : s;
}
const Y = (t, s) => {
  const i = t.length - 1,
    e = [];
  let h,
    o = 2 === s ? "<svg>" : 3 === s ? "<math>" : "",
    r = V;
  for (let s = 0; s < i; s++) {
    const i = t[s];
    let n,
      c,
      a = -1,
      l = 0;
    for (; l < i.length && ((r.lastIndex = l), (c = r.exec(i)), null !== c); )
      (l = r.lastIndex),
        r === V
          ? "!--" === c[1]
            ? (r = L)
            : void 0 !== c[1]
            ? (r = I)
            : void 0 !== c[2]
            ? (B.test(c[2]) && (h = RegExp("</" + c[2], "g")), (r = j))
            : void 0 !== c[3] && (r = j)
          : r === j
          ? ">" === c[0]
            ? ((r = h ?? V), (a = -1))
            : void 0 === c[1]
            ? (a = -2)
            : ((a = r.lastIndex - c[2].length),
              (n = c[1]),
              (r = void 0 === c[3] ? j : '"' === c[3] ? H : D))
          : r === H || r === D
          ? (r = j)
          : r === L || r === I
          ? (r = V)
          : ((r = j), (h = void 0));
    const u = r === j && t[s + 1].startsWith("/>") ? " " : "";
    o +=
      r === V
        ? i + A
        : a >= 0
        ? (e.push(n), i.slice(0, a) + x + i.slice(a) + M + u)
        : i + M + (-2 === a ? s : u);
  }
  return [
    X(t, o + (t[i] || "<?>") + (2 === s ? "</svg>" : 3 === s ? "</math>" : "")),
    e,
  ];
};
class tt {
  constructor({ strings: t, _$litType$: s }, i) {
    let e;
    this.parts = [];
    let h = 0,
      o = 0;
    const r = t.length - 1,
      n = this.parts,
      [c, a] = Y(t, s);
    if (
      ((this.el = tt.createElement(c, i)),
      (Q.currentNode = this.el.content),
      2 === s || 3 === s)
    ) {
      const t = this.el.content.firstChild;
      t.replaceWith(...t.childNodes);
    }
    for (; null !== (e = Q.nextNode()) && n.length < r; ) {
      if (1 === e.nodeType) {
        if (e.hasAttributes())
          for (const t of e.getAttributeNames())
            if (t.endsWith(x)) {
              const s = a[o++],
                i = e.getAttribute(t).split(M),
                r = /([.?@])?(.*)/.exec(s);
              n.push({
                type: 1,
                index: h,
                name: r[2],
                strings: i,
                ctor:
                  "." === r[1]
                    ? ot
                    : "?" === r[1]
                    ? rt
                    : "@" === r[1]
                    ? nt
                    : ht,
              }),
                e.removeAttribute(t);
            } else
              t.startsWith(M) &&
                (n.push({ type: 6, index: h }), e.removeAttribute(t));
        if (B.test(e.tagName)) {
          const t = e.textContent.split(M),
            s = t.length - 1;
          if (s > 0) {
            e.textContent = C ? C.emptyScript : "";
            for (let i = 0; i < s; i++)
              e.append(t[i], U()),
                Q.nextNode(),
                n.push({ type: 2, index: ++h });
            e.append(t[s], U());
          }
        }
      } else if (8 === e.nodeType)
        if (e.data === k) n.push({ type: 2, index: h });
        else {
          let t = -1;
          for (; -1 !== (t = e.data.indexOf(M, t + 1)); )
            n.push({ type: 7, index: h }), (t += M.length - 1);
        }
      h++;
    }
  }
  static createElement(t, s) {
    const i = E.createElement("template");
    return (i.innerHTML = t), i;
  }
}
function st(t, s, i = t, e) {
  if (s === F) return s;
  let h = void 0 !== e ? i.U?.[e] : i.N;
  const o = N(s) ? void 0 : s._$litDirective$;
  return (
    h?.constructor !== o &&
      (h?._$AO?.(!1),
      void 0 === o ? (h = void 0) : ((h = new o(t)), h._$AT(t, i, e)),
      void 0 !== e ? ((i.U ??= [])[e] = h) : (i.N = h)),
    void 0 !== h && (s = st(t, h._$AS(t, s.values), h, e)),
    s
  );
}
class it {
  constructor(t, s) {
    (this._$AV = []), (this._$AN = void 0), (this._$AD = t), (this._$AM = s);
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  O(t) {
    const {
        el: { content: s },
        parts: i,
      } = this._$AD,
      e = (t?.creationScope ?? E).importNode(s, !0);
    Q.currentNode = e;
    let h = Q.nextNode(),
      o = 0,
      r = 0,
      n = i[0];
    for (; void 0 !== n; ) {
      if (o === n.index) {
        let s;
        2 === n.type
          ? (s = new et(h, h.nextSibling, this, t))
          : 1 === n.type
          ? (s = new n.ctor(h, n.name, n.strings, this, t))
          : 6 === n.type && (s = new ct(h, this, t)),
          this._$AV.push(s),
          (n = i[++r]);
      }
      o !== n?.index && ((h = Q.nextNode()), o++);
    }
    return (Q.currentNode = E), e;
  }
  R(t) {
    let s = 0;
    for (const i of this._$AV)
      void 0 !== i &&
        (void 0 !== i.strings
          ? (i._$AI(t, i, s), (s += i.strings.length - 2))
          : i._$AI(t[s])),
        s++;
  }
}
class et {
  get _$AU() {
    return this._$AM?._$AU ?? this.V;
  }
  constructor(t, s, i, e) {
    (this.type = 2),
      (this._$AH = G),
      (this._$AN = void 0),
      (this._$AA = t),
      (this._$AB = s),
      (this._$AM = i),
      (this.options = e),
      (this.V = e?.isConnected ?? !0);
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const s = this._$AM;
    return void 0 !== s && 11 === t?.nodeType && (t = s.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, s = this) {
    (t = st(this, t, s)),
      N(t)
        ? t === G || null == t || "" === t
          ? (this._$AH !== G && this._$AR(), (this._$AH = G))
          : t !== this._$AH && t !== F && this.L(t)
        : void 0 !== t._$litType$
        ? this.I(t)
        : void 0 !== t.nodeType
        ? this.j(t)
        : R(t)
        ? this.D(t)
        : this.L(t);
  }
  H(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  j(t) {
    this._$AH !== t && (this._$AR(), (this._$AH = this.H(t)));
  }
  L(t) {
    this._$AH !== G && N(this._$AH)
      ? (this._$AA.nextSibling.data = t)
      : this.j(E.createTextNode(t)),
      (this._$AH = t);
  }
  I(t) {
    const { values: s, _$litType$: i } = t,
      e =
        "number" == typeof i
          ? this._$AC(t)
          : (void 0 === i.el &&
              (i.el = tt.createElement(X(i.h, i.h[0]), this.options)),
            i);
    if (this._$AH?._$AD === e) this._$AH.R(s);
    else {
      const t = new it(e, this),
        i = t.O(this.options);
      t.R(s), this.j(i), (this._$AH = t);
    }
  }
  _$AC(t) {
    let s = K.get(t.strings);
    return void 0 === s && K.set(t.strings, (s = new tt(t))), s;
  }
  D(t) {
    O(this._$AH) || ((this._$AH = []), this._$AR());
    const s = this._$AH;
    let i,
      e = 0;
    for (const h of t)
      e === s.length
        ? s.push((i = new et(this.H(U()), this.H(U()), this, this.options)))
        : (i = s[e]),
        i._$AI(h),
        e++;
    e < s.length && (this._$AR(i && i._$AB.nextSibling, e), (s.length = e));
  }
  _$AR(t = this._$AA.nextSibling, s) {
    for (this._$AP?.(!1, !0, s); t && t !== this._$AB; ) {
      const s = t.nextSibling;
      t.remove(), (t = s);
    }
  }
  setConnected(t) {
    void 0 === this._$AM && ((this.V = t), this._$AP?.(t));
  }
}
class ht {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, s, i, e, h) {
    (this.type = 1),
      (this._$AH = G),
      (this._$AN = void 0),
      (this.element = t),
      (this.name = s),
      (this._$AM = e),
      (this.options = h),
      i.length > 2 || "" !== i[0] || "" !== i[1]
        ? ((this._$AH = Array(i.length - 1).fill(new String())),
          (this.strings = i))
        : (this._$AH = G);
  }
  _$AI(t, s = this, i, e) {
    const h = this.strings;
    let o = !1;
    if (void 0 === h)
      (t = st(this, t, s, 0)),
        (o = !N(t) || (t !== this._$AH && t !== F)),
        o && (this._$AH = t);
    else {
      const e = t;
      let r, n;
      for (t = h[0], r = 0; r < h.length - 1; r++)
        (n = st(this, e[i + r], s, r)),
          n === F && (n = this._$AH[r]),
          (o ||= !N(n) || n !== this._$AH[r]),
          n === G ? (t = G) : t !== G && (t += (n ?? "") + h[r + 1]),
          (this._$AH[r] = n);
    }
    o && !e && this.B(t);
  }
  B(t) {
    t === G
      ? this.element.removeAttribute(this.name)
      : this.element.setAttribute(this.name, t ?? "");
  }
}
class ot extends ht {
  constructor() {
    super(...arguments), (this.type = 3);
  }
  B(t) {
    this.element[this.name] = t === G ? void 0 : t;
  }
}
class rt extends ht {
  constructor() {
    super(...arguments), (this.type = 4);
  }
  B(t) {
    this.element.toggleAttribute(this.name, !!t && t !== G);
  }
}
class nt extends ht {
  constructor(t, s, i, e, h) {
    super(t, s, i, e, h), (this.type = 5);
  }
  _$AI(t, s = this) {
    if ((t = st(this, t, s, 0) ?? G) === F) return;
    const i = this._$AH,
      e =
        (t === G && i !== G) ||
        t.capture !== i.capture ||
        t.once !== i.once ||
        t.passive !== i.passive,
      h = t !== G && (i === G || e);
    e && this.element.removeEventListener(this.name, this, i),
      h && this.element.addEventListener(this.name, this, t),
      (this._$AH = t);
  }
  handleEvent(t) {
    "function" == typeof this._$AH
      ? this._$AH.call(this.options?.host ?? this.element, t)
      : this._$AH.handleEvent(t);
  }
}
class ct {
  constructor(t, s, i) {
    (this.element = t),
      (this.type = 6),
      (this._$AN = void 0),
      (this._$AM = s),
      (this.options = i);
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    st(this, t);
  }
}
const at = {
    W: x,
    q: M,
    J: k,
    Z: 1,
    F: Y,
    G: it,
    K: R,
    X: st,
    Y: et,
    tt: ht,
    st: rt,
    it: nt,
    et: ot,
    ht: ct,
  },
  lt = P.litHtmlPolyfillSupport;
lt?.(tt, et), (P.litHtmlVersions ??= []).push("3.2.1");
const ut = (t, s, i) => {
  const e = i?.renderBefore ?? s;
  let h = e._$litPart$;
  if (void 0 === h) {
    const t = i?.renderBefore ?? null;
    e._$litPart$ = h = new et(s.insertBefore(U(), t), t, void 0, i ?? {});
  }
  return h._$AI(t), h;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class dt extends $ {
  constructor() {
    super(...arguments),
      (this.renderOptions = { host: this }),
      (this.ot = void 0);
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return (this.renderOptions.renderBefore ??= t.firstChild), t;
  }
  update(t) {
    const s = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected),
      super.update(t),
      (this.ot = ut(s, this.renderRoot, this.renderOptions));
  }
  connectedCallback() {
    super.connectedCallback(), this.ot?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.ot?.setConnected(!1);
  }
  render() {
    return F;
  }
}
(dt._$litElement$ = !0),
  (dt["finalized"] = !0),
  globalThis.litElementHydrateSupport?.({ LitElement: dt });
const ft = globalThis.litElementPolyfillSupport;
ft?.({ LitElement: dt });
const pt = {
  _$AK: (t, s, i) => {
    t._$AK(s, i);
  },
  _$AL: (t) => t._$AL,
};
(globalThis.litElementVersions ??= []).push("4.1.1");
/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const vt = !1;

// ----- Custom modification from the original source to map exports to types -----

/** @type {typeof import('lit').LitElement} */
export const LitElement = dt;
/** @type {typeof import('lit').ReactiveElement} */
export const ReactiveElement = $;
/** @type {typeof import('lit').CSSResult} */
export const CSSResult = h;
/** @type {typeof import('lit').css} */
export const css = r;
/** @type {typeof import('lit').html} */
export const html = q;
/** @type {typeof import("lit")._$LE} */
export const _$LE = pt;
/** @type {typeof import('lit')._$LH} */
export const _$LH = at;
/** @type {typeof import('lit').adoptStyles} */
export const adoptStyles = n;
/** @type {typeof import('lit').defaultConverter} */
export const defaultConverter = b;
/** @type {typeof import('lit').getCompatibleStyle} */
export const getCompatibleStyle = c;
/** @type {typeof import('lit').isServer} */
export const isServer = vt;
/** @type {typeof import('lit').mathml} */
export const mathml = Z;
/** @type {typeof import('lit').noChange} */
export const noChange = F;
/** @type {typeof import('lit').notEqual} */
export const notEqual = S;
/** @type {typeof import('lit').nothing} */
export const nothing = G;
/** @type {typeof import('lit').render} */
export const render = ut;
/** @type {typeof import('lit').supportsAdoptingStyleSheets} */
export const supportsAdoptingStyleSheets = s;
/** @type {typeof import('lit').svg} */
export const svg = J;
/** @type {typeof import('lit').unsafeCSS} */
export const unsafeCSS = o;

//# sourceMappingURL=lit-core.min.js.map
