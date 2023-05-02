
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }

    new Set();
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    new Map();

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const _boolean_attributes = [
        'allowfullscreen',
        'allowpaymentrequest',
        'async',
        'autofocus',
        'autoplay',
        'checked',
        'controls',
        'default',
        'defer',
        'disabled',
        'formnovalidate',
        'hidden',
        'inert',
        'ismap',
        'loop',
        'multiple',
        'muted',
        'nomodule',
        'novalidate',
        'open',
        'playsinline',
        'readonly',
        'required',
        'reversed',
        'selected'
    ];
    /**
     * List of HTML boolean attributes (e.g. `<input disabled>`).
     * Source: https://html.spec.whatwg.org/multipage/indices.html
     */
    new Set([..._boolean_attributes]);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.58.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\Card.svelte generated by Svelte v3.58.0 */

    const file$4 = "src\\Card.svelte";

    function create_fragment$4(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div0, "class", "inner-card svelte-jx4o04");
    			add_location(div0, file$4, 6, 8, 82);
    			attr_dev(div1, "class", "card svelte-jx4o04");
    			add_location(div1, file$4, 5, 4, 54);
    			attr_dev(div2, "class", "card-back");
    			add_location(div2, file$4, 4, 0, 25);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);

    			if (default_slot) {
    				default_slot.m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Card', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\CardHeader.svelte generated by Svelte v3.58.0 */

    const file$3 = "src\\CardHeader.svelte";

    function create_fragment$3(ctx) {
    	let header;
    	let img0;
    	let img0_src_value;
    	let t;
    	let div;
    	let img1;
    	let img1_src_value;

    	const block = {
    		c: function create() {
    			header = element("header");
    			img0 = element("img");
    			t = space();
    			div = element("div");
    			img1 = element("img");
    			if (!src_url_equal(img0.src, img0_src_value = "./img/title.svg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "Weight Converter Title");
    			attr_dev(img0, "class", "title svelte-1vlj4qc");
    			add_location(img0, file$3, 1, 4, 14);
    			if (!src_url_equal(img1.src, img1_src_value = "./img/bookmark.svg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "Bookmark");
    			attr_dev(img1, "class", "bookmark svelte-1vlj4qc");
    			add_location(img1, file$3, 3, 8, 132);
    			attr_dev(div, "class", "bookmark-container svelte-1vlj4qc");
    			add_location(div, file$3, 2, 4, 90);
    			add_location(header, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, img0);
    			append_dev(header, t);
    			append_dev(header, div);
    			append_dev(div, img1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CardHeader', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CardHeader> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class CardHeader extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CardHeader",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\Button.svelte generated by Svelte v3.58.0 */

    const file$2 = "src\\Button.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let p;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			p = element("p");
    			if (default_slot) default_slot.c();
    			attr_dev(p, "class", "svelte-1ob7yv5");
    			add_location(p, file$2, 3, 8, 107);
    			attr_dev(div0, "class", "button svelte-1ob7yv5");
    			add_location(div0, file$2, 1, 4, 11);
    			add_location(div1, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, p);

    			if (default_slot) {
    				default_slot.m(p, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(p, "click", /*click_handler*/ ctx[2], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\CardBody.svelte generated by Svelte v3.58.0 */
    const file$1 = "src\\CardBody.svelte";

    // (107:0) <Button on:click = {resetWeights}>
    function create_default_slot$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Reset");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(107:0) <Button on:click = {resetWeights}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let form_1;
    	let div0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div1;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let div2;
    	let label2;
    	let t7;
    	let input2;
    	let t8;
    	let div3;
    	let label3;
    	let t10;
    	let input3;
    	let t11;
    	let div4;
    	let label4;
    	let t13;
    	let input4;
    	let t14;
    	let div5;
    	let label5;
    	let t16;
    	let input5;
    	let t17;
    	let button;
    	let current;
    	let mounted;
    	let dispose;

    	button = new Button({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", /*resetWeights*/ ctx[2]);

    	const block = {
    		c: function create() {
    			form_1 = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Ounces:";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Kilograms:";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Pounds:";
    			t7 = space();
    			input2 = element("input");
    			t8 = space();
    			div3 = element("div");
    			label3 = element("label");
    			label3.textContent = "Grams:";
    			t10 = space();
    			input3 = element("input");
    			t11 = space();
    			div4 = element("div");
    			label4 = element("label");
    			label4.textContent = "Stones:";
    			t13 = space();
    			input4 = element("input");
    			t14 = space();
    			div5 = element("div");
    			label5 = element("label");
    			label5.textContent = "Tons:";
    			t16 = space();
    			input5 = element("input");
    			t17 = space();
    			create_component(button.$$.fragment);
    			attr_dev(label0, "for", "ounces");
    			attr_dev(label0, "class", "svelte-u58jp1");
    			add_location(label0, file$1, 81, 8, 2788);
    			attr_dev(input0, "class", "ounces svelte-u58jp1");
    			attr_dev(input0, "type", "number");
    			add_location(input0, file$1, 82, 8, 2833);
    			attr_dev(div0, "class", "form-input svelte-u58jp1");
    			add_location(div0, file$1, 80, 4, 2754);
    			attr_dev(label1, "for", "kgrams");
    			attr_dev(label1, "class", "svelte-u58jp1");
    			add_location(label1, file$1, 85, 8, 3002);
    			attr_dev(input1, "class", "kgrams svelte-u58jp1");
    			attr_dev(input1, "type", "number");
    			add_location(input1, file$1, 86, 8, 3050);
    			attr_dev(div1, "class", "form-input svelte-u58jp1");
    			add_location(div1, file$1, 84, 4, 2968);
    			attr_dev(label2, "for", "pounds");
    			attr_dev(label2, "class", "svelte-u58jp1");
    			add_location(label2, file$1, 89, 8, 3219);
    			attr_dev(input2, "class", "pounds svelte-u58jp1");
    			attr_dev(input2, "type", "number");
    			add_location(input2, file$1, 90, 8, 3264);
    			attr_dev(div2, "class", "form-input svelte-u58jp1");
    			add_location(div2, file$1, 88, 4, 3185);
    			attr_dev(label3, "for", "grams");
    			attr_dev(label3, "class", "svelte-u58jp1");
    			add_location(label3, file$1, 93, 8, 3433);
    			attr_dev(input3, "class", "grams svelte-u58jp1");
    			attr_dev(input3, "type", "number");
    			add_location(input3, file$1, 94, 8, 3476);
    			attr_dev(div3, "class", "form-input svelte-u58jp1");
    			add_location(div3, file$1, 92, 4, 3399);
    			attr_dev(label4, "for", "stones");
    			attr_dev(label4, "class", "svelte-u58jp1");
    			add_location(label4, file$1, 97, 8, 3643);
    			attr_dev(input4, "class", "stones svelte-u58jp1");
    			attr_dev(input4, "type", "number");
    			add_location(input4, file$1, 98, 8, 3688);
    			attr_dev(div4, "class", "form-input svelte-u58jp1");
    			add_location(div4, file$1, 96, 4, 3609);
    			attr_dev(label5, "for", "tons");
    			attr_dev(label5, "class", "svelte-u58jp1");
    			add_location(label5, file$1, 101, 8, 3857);
    			attr_dev(input5, "class", "tons svelte-u58jp1");
    			attr_dev(input5, "type", "number");
    			add_location(input5, file$1, 102, 8, 3898);
    			attr_dev(div5, "class", "form-input svelte-u58jp1");
    			add_location(div5, file$1, 100, 4, 3823);
    			attr_dev(form_1, "class", "svelte-u58jp1");
    			add_location(form_1, file$1, 79, 0, 2742);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form_1, anchor);
    			append_dev(form_1, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			set_input_value(input0, /*weights*/ ctx[0].ounces);
    			append_dev(form_1, t2);
    			append_dev(form_1, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t4);
    			append_dev(div1, input1);
    			set_input_value(input1, /*weights*/ ctx[0].kgrams);
    			append_dev(form_1, t5);
    			append_dev(form_1, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t7);
    			append_dev(div2, input2);
    			set_input_value(input2, /*weights*/ ctx[0].pounds);
    			append_dev(form_1, t8);
    			append_dev(form_1, div3);
    			append_dev(div3, label3);
    			append_dev(div3, t10);
    			append_dev(div3, input3);
    			set_input_value(input3, /*weights*/ ctx[0].grams);
    			append_dev(form_1, t11);
    			append_dev(form_1, div4);
    			append_dev(div4, label4);
    			append_dev(div4, t13);
    			append_dev(div4, input4);
    			set_input_value(input4, /*weights*/ ctx[0].stones);
    			append_dev(form_1, t14);
    			append_dev(form_1, div5);
    			append_dev(div5, label5);
    			append_dev(div5, t16);
    			append_dev(div5, input5);
    			set_input_value(input5, /*weights*/ ctx[0].tons);
    			insert_dev(target, t17, anchor);
    			mount_component(button, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[3]),
    					listen_dev(input0, "click", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input0, "input", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[4]),
    					listen_dev(input1, "click", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input1, "input", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[5]),
    					listen_dev(input2, "click", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input2, "input", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[6]),
    					listen_dev(input3, "click", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input3, "input", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[7]),
    					listen_dev(input4, "click", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input4, "input", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input5, "input", /*input5_input_handler*/ ctx[8]),
    					listen_dev(input5, "click", /*convertWeight*/ ctx[1], false, false, false, false),
    					listen_dev(input5, "input", /*convertWeight*/ ctx[1], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*weights*/ 1 && to_number(input0.value) !== /*weights*/ ctx[0].ounces) {
    				set_input_value(input0, /*weights*/ ctx[0].ounces);
    			}

    			if (dirty & /*weights*/ 1 && to_number(input1.value) !== /*weights*/ ctx[0].kgrams) {
    				set_input_value(input1, /*weights*/ ctx[0].kgrams);
    			}

    			if (dirty & /*weights*/ 1 && to_number(input2.value) !== /*weights*/ ctx[0].pounds) {
    				set_input_value(input2, /*weights*/ ctx[0].pounds);
    			}

    			if (dirty & /*weights*/ 1 && to_number(input3.value) !== /*weights*/ ctx[0].grams) {
    				set_input_value(input3, /*weights*/ ctx[0].grams);
    			}

    			if (dirty & /*weights*/ 1 && to_number(input4.value) !== /*weights*/ ctx[0].stones) {
    				set_input_value(input4, /*weights*/ ctx[0].stones);
    			}

    			if (dirty & /*weights*/ 1 && to_number(input5.value) !== /*weights*/ ctx[0].tons) {
    				set_input_value(input5, /*weights*/ ctx[0].tons);
    			}

    			const button_changes = {};

    			if (dirty & /*$$scope*/ 1024) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form_1);
    			if (detaching) detach_dev(t17);
    			destroy_component(button, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CardBody', slots, []);
    	let form = document.querySelector("form");

    	let weights = {
    		ounces: 0,
    		kgrams: 0,
    		pounds: 0,
    		grams: 0,
    		stones: 0,
    		tons: 0
    	};

    	const convertWeight = e => {
    		if (e.target.classList.contains("ounces")) {
    			let x = e.target.value;
    			$$invalidate(0, weights.kgrams = (x * 0.028349523).toFixed(2), weights);
    			$$invalidate(0, weights.pounds = (x / 16).toFixed(2), weights);
    			$$invalidate(0, weights.grams = (x * 28.34952).toFixed(2), weights);
    			$$invalidate(0, weights.stones = (x * 0.00446428571429).toFixed(2), weights);
    			$$invalidate(0, weights.tons = (x / 32000).toFixed(2), weights);
    		}

    		if (e.target.classList.contains("kgrams")) {
    			let x = e.target.value;
    			$$invalidate(0, weights.ounces = (x * 35.274).toFixed(2), weights);
    			$$invalidate(0, weights.pounds = (x * 2.2).toFixed(2), weights);
    			$$invalidate(0, weights.grams = (x * 1000).toFixed(2), weights);
    			$$invalidate(0, weights.stones = (x * 0.1575).toFixed(2), weights);
    			$$invalidate(0, weights.tons = (x * 0.001).toFixed(2), weights);
    		}

    		if (e.target.classList.contains("pounds")) {
    			let x = e.target.value;
    			$$invalidate(0, weights.ounces = (x * 16).toFixed(2), weights);
    			$$invalidate(0, weights.kgrams = (x * 0.45359237).toFixed(2), weights);
    			$$invalidate(0, weights.grams = (x * 453.59237).toFixed(2), weights);
    			$$invalidate(0, weights.stones = (x / 14).toFixed(2), weights);
    			$$invalidate(0, weights.tons = (x / 2000).toFixed(2), weights);
    		}

    		if (e.target.classList.contains("grams")) {
    			let x = e.target.value;
    			$$invalidate(0, weights.ounces = (x / 28.34952).toFixed(2), weights);
    			$$invalidate(0, weights.pounds = (x * 0.002205).toFixed(2), weights);
    			$$invalidate(0, weights.kgrams = (x / 1000).toFixed(2), weights);
    			$$invalidate(0, weights.stones = (x * 0.000157473).toFixed(2), weights);
    			$$invalidate(0, weights.tons = (x * 1.1023E-6).toFixed(2), weights);
    		}

    		if (e.target.classList.contains("stones")) {
    			let x = e.target.value;
    			$$invalidate(0, weights.ounces = (x * 224).toFixed(2), weights);
    			$$invalidate(0, weights.pounds = (x * 2.2).toFixed(2), weights);
    			$$invalidate(0, weights.grams = (x / 0.00015747).toFixed(2), weights);
    			$$invalidate(0, weights.kgrams = (x * 6.35029).toFixed(2), weights);
    			$$invalidate(0, weights.tons = (x / 157.47).toFixed(2), weights);
    		}

    		if (e.target.classList.contains("tons")) {
    			let x = e.target.value;
    			$$invalidate(0, weights.ounces = (x * 32000).toFixed(2), weights);
    			$$invalidate(0, weights.pounds = (x / 0.0004535923700100354).toFixed(2), weights);
    			$$invalidate(0, weights.grams = (x * 907184.74).toFixed(2), weights);
    			$$invalidate(0, weights.stones = (x * 157.473).toFixed(2), weights);
    			$$invalidate(0, weights.kgrams = (x * 1000).toFixed(2), weights);
    		}
    	};

    	const resetWeights = () => {
    		$$invalidate(0, weights.ounces = 0, weights);
    		$$invalidate(0, weights.kgrams = 0, weights);
    		$$invalidate(0, weights.pounds = 0, weights);
    		$$invalidate(0, weights.grams = 0, weights);
    		$$invalidate(0, weights.stones = 0, weights);
    		$$invalidate(0, weights.tons = 0, weights);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CardBody> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		weights.ounces = to_number(this.value);
    		$$invalidate(0, weights);
    	}

    	function input1_input_handler() {
    		weights.kgrams = to_number(this.value);
    		$$invalidate(0, weights);
    	}

    	function input2_input_handler() {
    		weights.pounds = to_number(this.value);
    		$$invalidate(0, weights);
    	}

    	function input3_input_handler() {
    		weights.grams = to_number(this.value);
    		$$invalidate(0, weights);
    	}

    	function input4_input_handler() {
    		weights.stones = to_number(this.value);
    		$$invalidate(0, weights);
    	}

    	function input5_input_handler() {
    		weights.tons = to_number(this.value);
    		$$invalidate(0, weights);
    	}

    	$$self.$capture_state = () => ({
    		Button,
    		form,
    		weights,
    		convertWeight,
    		resetWeights
    	});

    	$$self.$inject_state = $$props => {
    		if ('form' in $$props) form = $$props.form;
    		if ('weights' in $$props) $$invalidate(0, weights = $$props.weights);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		weights,
    		convertWeight,
    		resetWeights,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_input_handler
    	];
    }

    class CardBody extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CardBody",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.58.0 */
    const file = "src\\App.svelte";

    // (8:1) <Card>
    function create_default_slot(ctx) {
    	let cardheader;
    	let t;
    	let cardbody;
    	let current;
    	cardheader = new CardHeader({ $$inline: true });
    	cardbody = new CardBody({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(cardheader.$$.fragment);
    			t = space();
    			create_component(cardbody.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cardheader, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(cardbody, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cardheader.$$.fragment, local);
    			transition_in(cardbody.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cardheader.$$.fragment, local);
    			transition_out(cardbody.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cardheader, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(cardbody, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(8:1) <Card>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(card.$$.fragment);
    			attr_dev(main, "class", "svelte-46kz3n");
    			add_location(main, file, 6, 0, 145);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(card, main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const card_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Card, CardHeader, CardBody });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
