import Expo
import React
import ReactAppDependencyProvider

// @generated begin react-native-maps-import - expo prebuild (DO NOT MODIFY) sync-bee50fec513f89284e0fa3f5d935afdde33af98f
#if canImport(GoogleMaps)
import GoogleMaps
#endif
// @generated end react-native-maps-import
@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  private var startupBeganAt = Date()
  private var startupSawJSLoaded = false
  private var startupSawJSFailed = false
  private var startupSawContentAppeared = false

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    startupBeganAt = Date()
    startupSawJSLoaded = false
    startupSawJSFailed = false
    startupSawContentAppeared = false

    startupLog("didFinishLaunching begin")
    registerStartupObservers()

    let delegate = ReactNativeDelegate { [weak self] message in
      self?.startupLog(message)
    }
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    startupLog("created UIWindow frame=\(window?.frame.debugDescription ?? "(nil)")")
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    startupLog("factory.startReactNative called")
#endif

// @generated begin react-native-maps-init - expo prebuild (DO NOT MODIFY) sync-9baeb6762f843263fa5dc5dec031ae169ad4bf86
#if canImport(GoogleMaps)
GMSServices.provideAPIKey("AIzaSyB0DrlIVrSFZfc9-wCZHhpkri6ah3OFbYQ")
#endif
// @generated end react-native-maps-init

    scheduleStartupWatchdogs()
    let didLaunch = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    startupLog("didFinishLaunching end (success=\(didLaunch ? "YES" : "NO"))")
    return didLaunch
  }

  public override func applicationDidBecomeActive(_ application: UIApplication) {
    startupLog("UIApplicationDidBecomeActiveNotification received")
    logStartupState(prefix: "app_became_active")
    super.applicationDidBecomeActive(application)
  }

  public override func applicationWillResignActive(_ application: UIApplication) {
    startupLog("UIApplicationWillResignActiveNotification received")
    logStartupState(prefix: "app_will_resign_active")
    super.applicationWillResignActive(application)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  private func registerStartupObservers() {
    let center = NotificationCenter.default

    center.addObserver(
      self,
      selector: #selector(handleRCTJavaScriptDidLoad(_:)),
      name: Notification.Name("RCTJavaScriptDidLoadNotification"),
      object: nil
    )

    center.addObserver(
      self,
      selector: #selector(handleRCTJavaScriptDidFailToLoad(_:)),
      name: Notification.Name("RCTJavaScriptDidFailToLoadNotification"),
      object: nil
    )

    center.addObserver(
      self,
      selector: #selector(handleRCTContentDidAppear(_:)),
      name: Notification.Name("RCTContentDidAppearNotification"),
      object: nil
    )

    center.addObserver(
      self,
      selector: #selector(handleWindowDidBecomeVisible(_:)),
      name: UIWindow.didBecomeVisibleNotification,
      object: nil
    )

    center.addObserver(
      self,
      selector: #selector(handleWindowDidBecomeKey(_:)),
      name: UIWindow.didBecomeKeyNotification,
      object: nil
    )

    startupLog("Registered React startup observers")
  }

  private func scheduleStartupWatchdogs() {
    [3000, 8000, 15000].forEach { ms in
      DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(ms)) { [weak self] in
        self?.runStartupWatchdog(label: "t+\(ms)ms")
      }
    }
  }

  private func runStartupWatchdog(label: String) {
    if startupSawContentAppeared || startupSawJSFailed {
      return
    }

    startupLog("WATCHDOG \(label) fired before first RN content frame")
    logStartupState(prefix: "watchdog_\(label)")
    dumpForegroundSceneSummary()
    dumpMainThreadStack()
  }

  @objc
  private func handleRCTJavaScriptDidLoad(_ notification: Notification) {
    startupSawJSLoaded = true
    startupLog("RCTJavaScriptDidLoadNotification received")
    logStartupState(prefix: "on_js_loaded")
  }

  @objc
  private func handleRCTJavaScriptDidFailToLoad(_ notification: Notification) {
    startupSawJSFailed = true
    if let error = notification.userInfo?["error"] {
      startupLog("RCTJavaScriptDidFailToLoadNotification error=\(error)")
    } else {
      startupLog("RCTJavaScriptDidFailToLoadNotification received")
    }
    logStartupState(prefix: "on_js_failed")
  }

  @objc
  private func handleRCTContentDidAppear(_ notification: Notification) {
    startupSawContentAppeared = true
    startupLog("RCTContentDidAppearNotification received (first RN frame rendered)")
    logStartupState(prefix: "on_content_appeared")
  }

  @objc
  private func handleWindowDidBecomeVisible(_ notification: Notification) {
    guard let window = notification.object as? UIWindow else {
      startupLog("UIWindowDidBecomeVisibleNotification (non-window object)")
      return
    }
    startupLog("UIWindowDidBecomeVisibleNotification key=\(window.isKeyWindow) hidden=\(window.isHidden) alpha=\(window.alpha) rootVC=\(String(describing: type(of: window.rootViewController)))")
    logStartupState(prefix: "window_became_visible")
  }

  @objc
  private func handleWindowDidBecomeKey(_ notification: Notification) {
    guard let window = notification.object as? UIWindow else {
      startupLog("UIWindowDidBecomeKeyNotification (non-window object)")
      return
    }
    startupLog("UIWindowDidBecomeKeyNotification key=\(window.isKeyWindow) hidden=\(window.isHidden) alpha=\(window.alpha) rootVC=\(String(describing: type(of: window.rootViewController)))")
    logStartupState(prefix: "window_became_key")
  }

  private func logStartupState(prefix: String) {
    let elapsedMs = Int(Date().timeIntervalSince(startupBeganAt) * 1000.0)
    startupLog("state[\(prefix)] elapsedMs=\(elapsedMs) jsLoaded=\(startupSawJSLoaded) jsFailed=\(startupSawJSFailed) contentAppeared=\(startupSawContentAppeared)")
  }

  private func dumpForegroundSceneSummary() {
    let app = UIApplication.shared
    var summary = "[Startup] sceneSummary appState=\(app.applicationState.rawValue) connectedScenes=\(app.connectedScenes.count)"

    for scene in app.connectedScenes {
      guard let windowScene = scene as? UIWindowScene else {
        continue
      }
      summary += " | sceneActivation=\(windowScene.activationState.rawValue) windows=\(windowScene.windows.count)"
      for window in windowScene.windows {
        let rootName = window.rootViewController.map { String(describing: type(of: $0)) } ?? "nil"
        summary += " {key=\(window.isKeyWindow) hidden=\(window.isHidden) alpha=\(window.alpha) rootVC=\(rootName)}"
      }
    }

    print(summary)
  }

  private func dumpMainThreadStack() {
    let stack = Thread.callStackSymbols.joined(separator: " | ")
    if stack.isEmpty {
      startupLog("mainThreadStack unavailable")
      return
    }
    startupLog("mainThreadStack \(stack)")
  }

  fileprivate func startupLog(_ message: String) {
    print("[Startup] \(message)")
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  private let startupLog: ((String) -> Void)?

  init(startupLog: ((String) -> Void)? = nil) {
    self.startupLog = startupLog
    super.init()
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    let url = bridge.bundleURL ?? bundleURL()
    startupLog?("sourceURL(for bridge) resolved URL=\(url?.absoluteString ?? "(nil)")")
    return url
  }

  override func bundleURL() -> URL? {
#if DEBUG
    let url = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif

    guard let resolved = url else {
      startupLog?("ERROR: JS bundle URL is nil. Expected main.jsbundle in app bundle for release.")
      return nil
    }

    if resolved.isFileURL {
      do {
        let attrs = try FileManager.default.attributesOfItem(atPath: resolved.path)
        let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
        startupLog?("JS bundle path=\(resolved.path) size=\(size) bytes")
      } catch {
        startupLog?("JS bundle path=\(resolved.path) (attributes error=\(error.localizedDescription))")
      }
    } else {
      startupLog?("JS bundle URL=\(resolved.absoluteString)")
    }

    return resolved
  }

  override func createRootViewController() -> UIViewController {
    startupLog?("createRootViewController invoked")
    let controller = super.createRootViewController()
    startupLog?("createRootViewController returned \(String(describing: type(of: controller)))")
    return controller
  }

  override func customize(_ rootView: UIView) {
    startupLog?("customizeRootView invoked rootView=\(String(describing: type(of: rootView)))")
    super.customize(rootView)
  }

  override func newArchEnabled() -> Bool {
    startupLog?("newArchEnabled -> false")
    return false
  }

  override func bridgelessEnabled() -> Bool {
    startupLog?("bridgelessEnabled -> false")
    return false
  }

  override func fabricEnabled() -> Bool {
    startupLog?("fabricEnabled -> false")
    return false
  }

  override func turboModuleEnabled() -> Bool {
    startupLog?("turboModuleEnabled -> false")
    return false
  }
}
