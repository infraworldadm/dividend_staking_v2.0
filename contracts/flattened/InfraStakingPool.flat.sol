// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20 ^0.8.22 ^0.8.26;

// node_modules/@openzeppelin/contracts/utils/Errors.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/Errors.sol)

/**
 * @dev Collection of common custom errors used in multiple contracts
 *
 * IMPORTANT: Backwards compatibility is not guaranteed in future versions of the library.
 * It is recommended to avoid relying on the error API for critical functionality.
 *
 * _Available since v5.1._
 */
library Errors {
    /**
     * @dev The ETH balance of the account is not enough to perform the operation.
     */
    error InsufficientBalance(uint256 balance, uint256 needed);

    /**
     * @dev A call to an address target failed. The target may have reverted.
     */
    error FailedCall();

    /**
     * @dev The deployment failed.
     */
    error FailedDeployment();

    /**
     * @dev A necessary precompile is missing.
     */
    error MissingPrecompile(address);
}

// node_modules/@openzeppelin/contracts/proxy/beacon/IBeacon.sol

// OpenZeppelin Contracts (last updated v5.0.0) (proxy/beacon/IBeacon.sol)

/**
 * @dev This is the interface that {BeaconProxy} expects of its beacon.
 */
interface IBeacon {
    /**
     * @dev Must return an address that can be used as a delegate call target.
     *
     * {UpgradeableBeacon} will check that this address is a contract.
     */
    function implementation() external view returns (address);
}

// node_modules/@openzeppelin/contracts/interfaces/IERC1967.sol

// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/IERC1967.sol)

/**
 * @dev ERC-1967: Proxy Storage Slots. This interface contains the events defined in the ERC.
 */
interface IERC1967 {
    /**
     * @dev Emitted when the implementation is upgraded.
     */
    event Upgraded(address indexed implementation);

    /**
     * @dev Emitted when the admin account has changed.
     */
    event AdminChanged(address previousAdmin, address newAdmin);

    /**
     * @dev Emitted when the beacon is changed.
     */
    event BeaconUpgraded(address indexed beacon);
}

// node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (proxy/utils/Initializable.sol)

/**
 * @dev This is a base contract to aid in writing upgradeable contracts, or any kind of contract that will be deployed
 * behind a proxy. Since proxied contracts do not make use of a constructor, it's common to move constructor logic to an
 * external initializer function, usually called `initialize`. It then becomes necessary to protect this initializer
 * function so it can only be called once. The {initializer} modifier provided by this contract will have this effect.
 *
 * The initialization functions use a version number. Once a version number is used, it is consumed and cannot be
 * reused. This mechanism prevents re-execution of each "step" but allows the creation of new initialization steps in
 * case an upgrade adds a module that needs to be initialized.
 *
 * For example:
 *
 * [.hljs-theme-light.nopadding]
 * ```solidity
 * contract MyToken is ERC20Upgradeable {
 *     function initialize() initializer public {
 *         __ERC20_init("MyToken", "MTK");
 *     }
 * }
 *
 * contract MyTokenV2 is MyToken, ERC20PermitUpgradeable {
 *     function initializeV2() reinitializer(2) public {
 *         __ERC20Permit_init("MyToken");
 *     }
 * }
 * ```
 *
 * TIP: To avoid leaving the proxy in an uninitialized state, the initializer function should be called as early as
 * possible by providing the encoded function call as the `_data` argument to {ERC1967Proxy-constructor}.
 *
 * CAUTION: When used with inheritance, manual care must be taken to not invoke a parent initializer twice, or to ensure
 * that all initializers are idempotent. This is not verified automatically as constructors are by Solidity.
 *
 * [CAUTION]
 * ====
 * Avoid leaving a contract uninitialized.
 *
 * An uninitialized contract can be taken over by an attacker. This applies to both a proxy and its implementation
 * contract, which may impact the proxy. To prevent the implementation contract from being used, you should invoke
 * the {_disableInitializers} function in the constructor to automatically lock it when it is deployed:
 *
 * [.hljs-theme-light.nopadding]
 * ```
 * /// @custom:oz-upgrades-unsafe-allow constructor
 * constructor() {
 *     _disableInitializers();
 * }
 * ```
 * ====
 */
abstract contract Initializable {
    /**
     * @dev Storage of the initializable contract.
     *
     * It's implemented on a custom ERC-7201 namespace to reduce the risk of storage collisions
     * when using with upgradeable contracts.
     *
     * @custom:storage-location erc7201:openzeppelin.storage.Initializable
     */
    struct InitializableStorage {
        /**
         * @dev Indicates that the contract has been initialized.
         */
        uint64 _initialized;
        /**
         * @dev Indicates that the contract is in the process of being initialized.
         */
        bool _initializing;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Initializable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    /**
     * @dev The contract is already initialized.
     */
    error InvalidInitialization();

    /**
     * @dev The contract is not initializing.
     */
    error NotInitializing();

    /**
     * @dev Triggered when the contract has been initialized or reinitialized.
     */
    event Initialized(uint64 version);

    /**
     * @dev A modifier that defines a protected initializer function that can be invoked at most once. In its scope,
     * `onlyInitializing` functions can be used to initialize parent contracts.
     *
     * Similar to `reinitializer(1)`, except that in the context of a constructor an `initializer` may be invoked any
     * number of times. This behavior in the constructor can be useful during testing and is not expected to be used in
     * production.
     *
     * Emits an {Initialized} event.
     */
    modifier initializer() {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        // Cache values to avoid duplicated sloads
        bool isTopLevelCall = !$._initializing;
        uint64 initialized = $._initialized;

        // Allowed calls:
        // - initialSetup: the contract is not in the initializing state and no previous version was
        //                 initialized
        // - construction: the contract is initialized at version 1 (no reininitialization) and the
        //                 current contract is just being deployed
        bool initialSetup = initialized == 0 && isTopLevelCall;
        bool construction = initialized == 1 && address(this).code.length == 0;

        if (!initialSetup && !construction) {
            revert InvalidInitialization();
        }
        $._initialized = 1;
        if (isTopLevelCall) {
            $._initializing = true;
        }
        _;
        if (isTopLevelCall) {
            $._initializing = false;
            emit Initialized(1);
        }
    }

    /**
     * @dev A modifier that defines a protected reinitializer function that can be invoked at most once, and only if the
     * contract hasn't been initialized to a greater version before. In its scope, `onlyInitializing` functions can be
     * used to initialize parent contracts.
     *
     * A reinitializer may be used after the original initialization step. This is essential to configure modules that
     * are added through upgrades and that require initialization.
     *
     * When `version` is 1, this modifier is similar to `initializer`, except that functions marked with `reinitializer`
     * cannot be nested. If one is invoked in the context of another, execution will revert.
     *
     * Note that versions can jump in increments greater than 1; this implies that if multiple reinitializers coexist in
     * a contract, executing them in the right order is up to the developer or operator.
     *
     * WARNING: Setting the version to 2**64 - 1 will prevent any future reinitialization.
     *
     * Emits an {Initialized} event.
     */
    modifier reinitializer(uint64 version) {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        if ($._initializing || $._initialized >= version) {
            revert InvalidInitialization();
        }
        $._initialized = version;
        $._initializing = true;
        _;
        $._initializing = false;
        emit Initialized(version);
    }

    /**
     * @dev Modifier to protect an initialization function so that it can only be invoked by functions with the
     * {initializer} and {reinitializer} modifiers, directly or indirectly.
     */
    modifier onlyInitializing() {
        _checkInitializing();
        _;
    }

    /**
     * @dev Reverts if the contract is not in an initializing state. See {onlyInitializing}.
     */
    function _checkInitializing() internal view virtual {
        if (!_isInitializing()) {
            revert NotInitializing();
        }
    }

    /**
     * @dev Locks the contract, preventing any future reinitialization. This cannot be part of an initializer call.
     * Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
     * to any version. It is recommended to use this to lock implementation contracts that are designed to be called
     * through proxies.
     *
     * Emits an {Initialized} event the first time it is successfully executed.
     */
    function _disableInitializers() internal virtual {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        if ($._initializing) {
            revert InvalidInitialization();
        }
        if ($._initialized != type(uint64).max) {
            $._initialized = type(uint64).max;
            emit Initialized(type(uint64).max);
        }
    }

    /**
     * @dev Returns the highest version that has been initialized. See {reinitializer}.
     */
    function _getInitializedVersion() internal view returns (uint64) {
        return _getInitializableStorage()._initialized;
    }

    /**
     * @dev Returns `true` if the contract is currently initializing. See {onlyInitializing}.
     */
    function _isInitializing() internal view returns (bool) {
        return _getInitializableStorage()._initializing;
    }

    /**
     * @dev Returns a pointer to the storage namespace.
     */
    // solhint-disable-next-line var-name-mixedcase
    function _getInitializableStorage() private pure returns (InitializableStorage storage $) {
        assembly {
            $.slot := INITIALIZABLE_STORAGE
        }
    }
}

// node_modules/@openzeppelin/contracts/utils/StorageSlot.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}

// node_modules/@openzeppelin/contracts/interfaces/draft-IERC1822.sol

// OpenZeppelin Contracts (last updated v5.1.0) (interfaces/draft-IERC1822.sol)

/**
 * @dev ERC-1822: Universal Upgradeable Proxy Standard (UUPS) documents a method for upgradeability through a simplified
 * proxy whose upgrades are fully controlled by the current implementation.
 */
interface IERC1822Proxiable {
    /**
     * @dev Returns the storage slot that the proxiable contract assumes is being used to store the implementation
     * address.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy.
     */
    function proxiableUUID() external view returns (bytes32);
}

// node_modules/@openzeppelin/contracts/utils/Address.sol

// OpenZeppelin Contracts (last updated v5.2.0) (utils/Address.sol)

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev There's no code at `target` (it is not a contract).
     */
    error AddressEmptyCode(address target);

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.20/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert Errors.InsufficientBalance(address(this).balance, amount);
        }

        (bool success, bytes memory returndata) = recipient.call{value: amount}("");
        if (!success) {
            _revert(returndata);
        }
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason or custom error, it is bubbled
     * up by this function (like regular Solidity function calls). However, if
     * the call reverted with no returned reason, this function reverts with a
     * {Errors.FailedCall} error.
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert Errors.InsufficientBalance(address(this).balance, value);
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and reverts if the target
     * was not a contract or bubbling up the revert reason (falling back to {Errors.FailedCall}) in case
     * of an unsuccessful call.
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            // only check if target is a contract if the call was successful and the return data is empty
            // otherwise we already know that it was a contract
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and reverts if it wasn't, either by bubbling the
     * revert reason or with a default {Errors.FailedCall} error.
     */
    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    /**
     * @dev Reverts with returndata if present. Otherwise reverts with {Errors.FailedCall}.
     */
    function _revert(bytes memory returndata) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            assembly ("memory-safe") {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert Errors.FailedCall();
        }
    }
}

// node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract ContextUpgradeable is Initializable {
    function __Context_init() internal onlyInitializing {
    }

    function __Context_init_unchained() internal onlyInitializing {
    }
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// node_modules/@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuardUpgradeable is Initializable {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /// @custom:storage-location erc7201:openzeppelin.storage.ReentrancyGuard
    struct ReentrancyGuardStorage {
        uint256 _status;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ReentrancyGuardStorageLocation = 0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    function _getReentrancyGuardStorage() private pure returns (ReentrancyGuardStorage storage $) {
        assembly {
            $.slot := ReentrancyGuardStorageLocation
        }
    }

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    function __ReentrancyGuard_init() internal onlyInitializing {
        __ReentrancyGuard_init_unchained();
    }

    function __ReentrancyGuard_init_unchained() internal onlyInitializing {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        $._status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if ($._status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        $._status = ENTERED;
    }

    function _nonReentrantAfter() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        $._status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        return $._status == ENTERED;
    }
}

// node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract OwnableUpgradeable is Initializable, ContextUpgradeable {
    /// @custom:storage-location erc7201:openzeppelin.storage.Ownable
    struct OwnableStorage {
        address _owner;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant OwnableStorageLocation = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;

    function _getOwnableStorage() private pure returns (OwnableStorage storage $) {
        assembly {
            $.slot := OwnableStorageLocation
        }
    }

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    function __Ownable_init(address initialOwner) internal onlyInitializing {
        __Ownable_init_unchained(initialOwner);
    }

    function __Ownable_init_unchained(address initialOwner) internal onlyInitializing {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        OwnableStorage storage $ = _getOwnableStorage();
        return $._owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        OwnableStorage storage $ = _getOwnableStorage();
        address oldOwner = $._owner;
        $._owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// node_modules/@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol

// OpenZeppelin Contracts (last updated v5.2.0) (proxy/ERC1967/ERC1967Utils.sol)

/**
 * @dev This library provides getters and event emitting update functions for
 * https://eips.ethereum.org/EIPS/eip-1967[ERC-1967] slots.
 */
library ERC1967Utils {
    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1.
     */
    // solhint-disable-next-line private-vars-leading-underscore
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * @dev The `implementation` of the proxy is invalid.
     */
    error ERC1967InvalidImplementation(address implementation);

    /**
     * @dev The `admin` of the proxy is invalid.
     */
    error ERC1967InvalidAdmin(address admin);

    /**
     * @dev The `beacon` of the proxy is invalid.
     */
    error ERC1967InvalidBeacon(address beacon);

    /**
     * @dev An upgrade function sees `msg.value > 0` that may be lost.
     */
    error ERC1967NonPayable();

    /**
     * @dev Returns the current implementation address.
     */
    function getImplementation() internal view returns (address) {
        return StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value;
    }

    /**
     * @dev Stores a new address in the ERC-1967 implementation slot.
     */
    function _setImplementation(address newImplementation) private {
        if (newImplementation.code.length == 0) {
            revert ERC1967InvalidImplementation(newImplementation);
        }
        StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = newImplementation;
    }

    /**
     * @dev Performs implementation upgrade with additional setup call if data is nonempty.
     * This function is payable only if the setup call is performed, otherwise `msg.value` is rejected
     * to avoid stuck value in the contract.
     *
     * Emits an {IERC1967-Upgraded} event.
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) internal {
        _setImplementation(newImplementation);
        emit IERC1967.Upgraded(newImplementation);

        if (data.length > 0) {
            Address.functionDelegateCall(newImplementation, data);
        } else {
            _checkNonPayable();
        }
    }

    /**
     * @dev Storage slot with the admin of the contract.
     * This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1.
     */
    // solhint-disable-next-line private-vars-leading-underscore
    bytes32 internal constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @dev Returns the current admin.
     *
     * TIP: To get this value clients can read directly from the storage slot shown below (specified by ERC-1967) using
     * the https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
     * `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`
     */
    function getAdmin() internal view returns (address) {
        return StorageSlot.getAddressSlot(ADMIN_SLOT).value;
    }

    /**
     * @dev Stores a new address in the ERC-1967 admin slot.
     */
    function _setAdmin(address newAdmin) private {
        if (newAdmin == address(0)) {
            revert ERC1967InvalidAdmin(address(0));
        }
        StorageSlot.getAddressSlot(ADMIN_SLOT).value = newAdmin;
    }

    /**
     * @dev Changes the admin of the proxy.
     *
     * Emits an {IERC1967-AdminChanged} event.
     */
    function changeAdmin(address newAdmin) internal {
        emit IERC1967.AdminChanged(getAdmin(), newAdmin);
        _setAdmin(newAdmin);
    }

    /**
     * @dev The storage slot of the UpgradeableBeacon contract which defines the implementation for this proxy.
     * This is the keccak-256 hash of "eip1967.proxy.beacon" subtracted by 1.
     */
    // solhint-disable-next-line private-vars-leading-underscore
    bytes32 internal constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    /**
     * @dev Returns the current beacon.
     */
    function getBeacon() internal view returns (address) {
        return StorageSlot.getAddressSlot(BEACON_SLOT).value;
    }

    /**
     * @dev Stores a new beacon in the ERC-1967 beacon slot.
     */
    function _setBeacon(address newBeacon) private {
        if (newBeacon.code.length == 0) {
            revert ERC1967InvalidBeacon(newBeacon);
        }

        StorageSlot.getAddressSlot(BEACON_SLOT).value = newBeacon;

        address beaconImplementation = IBeacon(newBeacon).implementation();
        if (beaconImplementation.code.length == 0) {
            revert ERC1967InvalidImplementation(beaconImplementation);
        }
    }

    /**
     * @dev Change the beacon and trigger a setup call if data is nonempty.
     * This function is payable only if the setup call is performed, otherwise `msg.value` is rejected
     * to avoid stuck value in the contract.
     *
     * Emits an {IERC1967-BeaconUpgraded} event.
     *
     * CAUTION: Invoking this function has no effect on an instance of {BeaconProxy} since v5, since
     * it uses an immutable beacon without looking at the value of the ERC-1967 beacon slot for
     * efficiency.
     */
    function upgradeBeaconToAndCall(address newBeacon, bytes memory data) internal {
        _setBeacon(newBeacon);
        emit IERC1967.BeaconUpgraded(newBeacon);

        if (data.length > 0) {
            Address.functionDelegateCall(IBeacon(newBeacon).implementation(), data);
        } else {
            _checkNonPayable();
        }
    }

    /**
     * @dev Reverts if `msg.value` is not zero. It can be used to avoid `msg.value` stuck in the contract
     * if an upgrade doesn't perform an initialization call.
     */
    function _checkNonPayable() private {
        if (msg.value > 0) {
            revert ERC1967NonPayable();
        }
    }
}

// node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol

// OpenZeppelin Contracts (last updated v5.2.0) (proxy/utils/UUPSUpgradeable.sol)

/**
 * @dev An upgradeability mechanism designed for UUPS proxies. The functions included here can perform an upgrade of an
 * {ERC1967Proxy}, when this contract is set as the implementation behind such a proxy.
 *
 * A security mechanism ensures that an upgrade does not turn off upgradeability accidentally, although this risk is
 * reinstated if the upgrade retains upgradeability but removes the security mechanism, e.g. by replacing
 * `UUPSUpgradeable` with a custom implementation of upgrades.
 *
 * The {_authorizeUpgrade} function must be overridden to include access restriction to the upgrade mechanism.
 */
abstract contract UUPSUpgradeable is Initializable, IERC1822Proxiable {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address private immutable __self = address(this);

    /**
     * @dev The version of the upgrade interface of the contract. If this getter is missing, both `upgradeTo(address)`
     * and `upgradeToAndCall(address,bytes)` are present, and `upgradeTo` must be used if no function should be called,
     * while `upgradeToAndCall` will invoke the `receive` function if the second argument is the empty byte string.
     * If the getter returns `"5.0.0"`, only `upgradeToAndCall(address,bytes)` is present, and the second argument must
     * be the empty byte string if no function should be called, making it impossible to invoke the `receive` function
     * during an upgrade.
     */
    string public constant UPGRADE_INTERFACE_VERSION = "5.0.0";

    /**
     * @dev The call is from an unauthorized context.
     */
    error UUPSUnauthorizedCallContext();

    /**
     * @dev The storage `slot` is unsupported as a UUID.
     */
    error UUPSUnsupportedProxiableUUID(bytes32 slot);

    /**
     * @dev Check that the execution is being performed through a delegatecall call and that the execution context is
     * a proxy contract with an implementation (as defined in ERC-1967) pointing to self. This should only be the case
     * for UUPS and transparent proxies that are using the current contract as their implementation. Execution of a
     * function through ERC-1167 minimal proxies (clones) would not normally pass this test, but is not guaranteed to
     * fail.
     */
    modifier onlyProxy() {
        _checkProxy();
        _;
    }

    /**
     * @dev Check that the execution is not being performed through a delegate call. This allows a function to be
     * callable on the implementing contract but not through proxies.
     */
    modifier notDelegated() {
        _checkNotDelegated();
        _;
    }

    function __UUPSUpgradeable_init() internal onlyInitializing {
    }

    function __UUPSUpgradeable_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev Implementation of the ERC-1822 {proxiableUUID} function. This returns the storage slot used by the
     * implementation. It is used to validate the implementation's compatibility when performing an upgrade.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy. This is guaranteed by the `notDelegated` modifier.
     */
    function proxiableUUID() external view virtual notDelegated returns (bytes32) {
        return ERC1967Utils.IMPLEMENTATION_SLOT;
    }

    /**
     * @dev Upgrade the implementation of the proxy to `newImplementation`, and subsequently execute the function call
     * encoded in `data`.
     *
     * Calls {_authorizeUpgrade}.
     *
     * Emits an {Upgraded} event.
     *
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) public payable virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data);
    }

    /**
     * @dev Reverts if the execution is not performed via delegatecall or the execution
     * context is not of a proxy with an ERC-1967 compliant implementation pointing to self.
     * See {_onlyProxy}.
     */
    function _checkProxy() internal view virtual {
        if (
            address(this) == __self || // Must be called through delegatecall
            ERC1967Utils.getImplementation() != __self // Must be called through an active proxy
        ) {
            revert UUPSUnauthorizedCallContext();
        }
    }

    /**
     * @dev Reverts if the execution is performed via delegatecall.
     * See {notDelegated}.
     */
    function _checkNotDelegated() internal view virtual {
        if (address(this) != __self) {
            // Must not be called through delegatecall
            revert UUPSUnauthorizedCallContext();
        }
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeToAndCall}.
     *
     * Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.
     *
     * ```solidity
     * function _authorizeUpgrade(address) internal onlyOwner {}
     * ```
     */
    function _authorizeUpgrade(address newImplementation) internal virtual;

    /**
     * @dev Performs an implementation upgrade with a security check for UUPS proxies, and additional setup call.
     *
     * As a security check, {proxiableUUID} is invoked in the new implementation, and the return value
     * is expected to be the implementation slot in ERC-1967.
     *
     * Emits an {IERC1967-Upgraded} event.
     */
    function _upgradeToAndCallUUPS(address newImplementation, bytes memory data) private {
        try IERC1822Proxiable(newImplementation).proxiableUUID() returns (bytes32 slot) {
            if (slot != ERC1967Utils.IMPLEMENTATION_SLOT) {
                revert UUPSUnsupportedProxiableUUID(slot);
            }
            ERC1967Utils.upgradeToAndCall(newImplementation, data);
        } catch {
            // The implementation is not UUPS
            revert ERC1967Utils.ERC1967InvalidImplementation(newImplementation);
        }
    }
}

// src/InfraStakingPool.sol

/// @dev DividendPoolNativeV2 (upgraded) sends its whole balance to the staking contract.
interface IDividendPoolPull {
    function pullForStaking() external returns (uint256);
}

/**
 * @title  InfraStakingPool
 * @notice Monthly reward pool for native reAED stakers on the INFRA network.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  OVERVIEW
 * ────────────────────────────────────────────────────────────────────────────
 *  Money flow (FULLY AUTOMATIC — no admin signature needed):
 *    Network fees ──► DividendPoolNativeV2 (collects during month M)
 *    first transaction after month M closes (any stake/claim/withdraw, or poke() by the
 *    keeper) ──► pulls the whole dividend-pool balance as month M's reward pool
 *    ──► split by weight ──► stakers claim within 30 days ──► leftovers auto-swept to admin
 *
 *  Cycles ("epochs")
 *    - One epoch = one calendar month in UTC.
 *    - Epoch id = year * 12 + (month - 1). Example: October 2026 = 2026*12 + 9 = 24321.
 *
 *  Staking — MULTIPLE POSITIONS PER WALLET
 *    - Every stake() opens a new POSITION with its own amount and lock. Accepted locks are
 *      set by the owner (default 1, 2, 6, 8, 9 or 12 months; see setAllowedPeriod).
 *      A wallet can hold up to MAX_POSITIONS open positions at the same time.
 *    - A position opened during month M becomes ACTIVE at the start of month M+1
 *      (the running month is closed to new stakes).
 *    - It earns ONLY for its lock months: activeFrom .. activeFrom + periods - 1.
 *    - When the lock ends the position STOPS earning. The staker then has a 30-day
 *      grace period to withdraw(positionId) the principal TOGETHER WITH its rewards.
 *    - After the grace period the staker can withdraw the PRINCIPAL ONLY; unclaimed
 *      rewards are forfeited and go to the ADMIN WALLET (sweepExpired).
 *    - Anyone (e.g. an admin/keeper script) may releaseStakes(users) after the grace
 *      period to send principal back to each staker's own wallet.
 *
 *  Rewards (no APR is promised)
 *    - Rewards come ONLY from the dividend pool (DividendPoolNativeV2) or the owner.
 *    - AUTO-PULL: the first state-changing call in a new month asks the dividend pool
 *      (pullForStaking) for its whole balance and books it as the month that just closed.
 *      Nobody has to send anything by hand. poke() lets a keeper trigger it daily.
 *    - Manual top-ups still work: sendRewardsToStaking / fundEpoch add to the RUNNING month.
 *    - Weight = position amount × month length (positions always earn whole months).
 *    - Reward of a position for month M = M's pool × position weight ÷ total weight of M.
 *
 *  Claiming
 *    - When month M closes, its rewards are claimable for CLAIM_WINDOW (30 days).
 *      claim() collects rewards from ALL of the wallet's positions at once.
 *    - After the window, unclaimed rewards expire and are AUTO-SWEPT to the ADMIN WALLET
 *      by the next transaction (or poke()); sweepExpired(M) does it by hand.
 *    - A month nobody staked in can be swept to the admin wallet as soon as it closes.
 *
 *  Owner (MUST be a multisig, e.g. Gnosis Safe)
 *    - Upgrade the contract (UUPS).
 *    - setDividendPool(), setAdminWallet(), setAllowedPeriod(), setAutoPull(), fundEpoch().
 *    - ownerWithdrawRewards(): reward funds only, never stakers' principal.
 *    - emergencyWithdraw(): ANY amount, including principal.
 *
 *  Keeper / automation
 *    - poke(): public; runs the monthly automation (weights, auto-pull, auto-sweep).
 *    - needsPoke(): view for keepers — true when poke() would do something.
 *
 *  Scalability
 *    No loops over users. Per-month totals come from activeAmount,
 *    scheduledActivation and scheduledDeactivation. Per-wallet loops are bounded by
 *    MAX_POSITIONS and by the number of months since the last claim.
 */
contract InfraStakingPool is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ════════════════════════════════════════════════════════════════════
    //  CONSTANTS
    // ════════════════════════════════════════════════════════════════════

    /// @notice How long a closed month's rewards stay claimable (30 days after month end).
    ///         Also the grace period after a position's lock ends.
    uint256 public constant CLAIM_WINDOW = 30 days;

    /// @notice Maximum lock length in months.
    uint256 public constant MAX_PERIODS = 12;

    /// @notice Maximum number of open positions per wallet (bounds gas of claim()).
    uint256 public constant MAX_POSITIONS = 20;

    // ════════════════════════════════════════════════════════════════════
    //  STORAGE
    //  Slots 0–11 keep the EXACT layout of the previous implementation
    //  (StakingPoolFromDividendPoolV2) so this contract can be installed on the
    //  existing proxy with upgradeToAndCall(..., upgradeToMonthlyPool(...)).
    //  New state lives in what was that contract's __gap (slots 12+, all zero).
    //  Append-only from here: never reorder or remove when upgrading again.
    // ════════════════════════════════════════════════════════════════════

    /// @dev Previous implementation's per-user record (slot 2). No longer used.
    struct LegacyUserInfo {
        uint256 amount;
        uint256 startDate;
        uint256 countOfPeriods;
        uint256 endDate;
        uint256 weight;
        uint256 lastUpdate;
        uint256 rewardDebt;
        uint256 pendingClaimable;
        uint256 totalClaimed;
        uint256 rewardExpiryAt;
        uint256 expiredRewardsTotal;
    }

    // ── slots 0–11: previous implementation (kept in place) ──

    /// @notice slot 0 — DividendPoolNativeV2: the ONLY non-owner source of rewards.
    address public dividendPool;
    /// @notice slot 1 — wallet that receives expired rewards (was `rewardAdmin`).
    address public adminWallet;
    /// @dev slot 2 — legacy per-user records (unused; must hold no live stakes to upgrade).
    mapping(address => LegacyUserInfo) private legacyUsers;
    /// @notice slot 3 — principal currently held for stakers (all open positions).
    uint256 public totalStaked;
    /// @notice slot 4 — legacy totalLocked (must be 0 to upgrade).
    uint256 public legacyTotalLocked;
    uint256 private legacyTotalWeight; // slot 5
    uint256 private legacyLastGlobalUpdate; // slot 6
    uint256 private legacyAccRewardPerWeight; // slot 7
    uint256 private legacyRewardVaultBalance; // slot 8
    uint256 private legacyUndistributedRewards; // slot 9
    uint256 private legacyTotalRewarded; // slot 10
    uint256 private legacyTotalExpired; // slot 11

    // ── slots 12+: monthly pool ──

    /// @notice One stake position.
    struct Position {
        uint256 amount; // principal of this position
        uint64 id; // per-wallet id, stable for the position's lifetime
        uint64 stakedAt; // timestamp of stake()
        uint64 periods; // lock length in months
        uint64 activeFrom; // first earning epoch (month after staking)
        uint64 lockEnd; // earning stops & withdraw allowed (start of month activeFrom+periods)
        uint64 lastSettledEpoch; // epochs <= this are already paid or expired for this position
    }

    /// @notice Per-wallet totals.
    struct Account {
        uint256 staked; // principal across open positions
        uint256 totalClaimed; // lifetime rewards paid
        uint256 totalExpired; // lifetime rewards forfeited (claim window passed)
        uint64 nextId; // id for the next position
    }

    /// @dev slot 12 — open positions per wallet (withdrawn positions are removed).
    mapping(address => Position[]) internal _positions;
    /// @notice slot 13 — per-wallet totals.
    mapping(address => Account) public accounts;
    /// @notice slot 14 — principal earning in epoch `lastSyncedEpoch` (and later, until it changes).
    uint256 public activeAmount;
    /// @notice slot 15 — latest epoch whose base weight has been written to storage by _sync().
    uint256 public lastSyncedEpoch;
    /// @notice epoch => principal that starts earning at the beginning of that epoch.
    mapping(uint256 => uint256) public scheduledActivation;
    /// @notice epoch => principal that stops earning at the beginning of that epoch (lock ended).
    mapping(uint256 => uint256) public scheduledDeactivation;
    /// @notice epoch => activeAmount × epoch length, snapshotted when the epoch starts.
    mapping(uint256 => uint256) public epochBaseWeight;
    /// @notice epoch => reward pool (reAED) to be split among that epoch's positions.
    mapping(uint256 => uint256) public epochReward;
    /// @notice epoch => rewards already paid out from that epoch's pool.
    mapping(uint256 => uint256) public epochClaimed;
    /// @notice epoch => true once its expired/unclaimed rewards were sent to the admin wallet.
    mapping(uint256 => bool) public epochSwept;
    /// @notice Lifetime reAED received as rewards.
    uint256 public totalRewardsReceived;
    /// @notice Lifetime reAED paid to stakers as rewards.
    uint256 public totalRewardsClaimed;
    /// @notice Lifetime reAED taken by the owner via ownerWithdrawRewards().
    uint256 public totalRewardsWithdrawnByOwner;
    /// @notice Lifetime expired rewards sent to the admin wallet.
    uint256 public totalExpiredSwept;
    /// @notice slot 26 — lock lengths (in months) that stake() accepts. Default: 1, 2, 6, 8, 9, 12.
    mapping(uint256 => bool) public isAllowedPeriod;
    /// @notice slot 27 — wallets with at least one open position.
    uint256 public stakerCount;
    /// @notice slot 28 — open positions across all wallets.
    uint256 public openPositions;
    /// @notice slot 29 — latest month in which the dividend pool was auto-pulled.
    uint256 public lastPulledEpoch;
    /// @notice slot 30 — oldest month the auto-sweeper still has to look at.
    uint256 public nextSweepEpoch;
    /// @notice slot 31 — auto-pull on/off (owner). Requires DividendPoolNativeV2.pullForStaking().
    bool public autoPullEnabled;
    /// @dev slot 31 (packed) — true only while pullForStaking() is sending to receive().
    bool private _pulling;

    // ════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ════════════════════════════════════════════════════════════════════

    /// @notice A wallet opened position `positionId`, earning from epoch `activeFrom`, withdrawable after `lockEnd`.
    event Staked(
        address indexed user, uint256 indexed positionId, uint256 amount, uint256 periods, uint256 activeFrom, uint256 lockEnd
    );
    /// @notice A position's principal was returned to its owner (by itself or a releaser).
    event Withdrawn(address indexed user, uint256 indexed positionId, uint256 amount, address caller);
    /// @notice A wallet received `amount` rewards.
    event Claimed(address indexed user, uint256 amount);
    /// @notice Some of a wallet's rewards expired (claim window passed).
    event RewardsExpiredForUser(address indexed user, uint256 amount);
    /// @notice `amount` reAED was added to `epoch`'s reward pool by `from`.
    event RewardsFunded(address indexed from, uint256 indexed epoch, uint256 amount);
    /// @notice Expired rewards of `epoch` were sent to the admin wallet.
    event ExpiredRewardsSwept(uint256 indexed epoch, address indexed adminWallet, uint256 amount);
    /// @notice The dividend pool address was changed.
    event DividendPoolUpdated(address indexed oldPool, address indexed newPool);
    /// @notice The admin wallet (receiver of expired rewards) was changed.
    event AdminWalletUpdated(address indexed oldWallet, address indexed newWallet);
    /// @notice A lock length was enabled or disabled for new stakes.
    event AllowedPeriodSet(uint256 periods, bool allowed);
    /// @notice Owner withdrew reward (non-principal) funds.
    event OwnerRewardsWithdrawn(address indexed to, uint256 amount);
    /// @notice Owner withdrew funds through the emergency path (may include principal).
    event EmergencyWithdraw(address indexed to, uint256 amount);
    /// @notice Auto-pull ran for `epoch` (the month that just closed); `amount` may be 0.
    event AutoPulled(uint256 indexed epoch, uint256 amount, bool ok);
    event AutoPullSet(bool enabled);

    // ════════════════════════════════════════════════════════════════════
    //  SETUP / UPGRADES
    // ════════════════════════════════════════════════════════════════════

    /// @dev Locks the implementation contract so only a proxy can be initialized.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice One-time setup for a NEW proxy.
     * @param initialOwner  admin of the pool — use the Gnosis Safe multisig address.
     * @param dividendPool_ DividendPoolNativeV2 — the ONLY non-owner source of rewards.
     * @param adminWallet_  wallet that receives expired rewards.
     */
    function initialize(address initialOwner, address dividendPool_, address adminWallet_) public initializer {
        require(dividendPool_ != address(0) && adminWallet_ != address(0), "zero address");
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        dividendPool = dividendPool_;
        adminWallet = adminWallet_;
        lastSyncedEpoch = currentEpoch();
        _setDefaultPeriods();
        _initAutomation();
        emit DividendPoolUpdated(address(0), dividendPool_);
        emit AdminWalletUpdated(address(0), adminWallet_);
    }

    /**
     * @notice One-time migration when installing this contract on the EXISTING proxy that
     *         ran StakingPoolFromDividendPoolV2. Call it through
     *         upgradeToAndCall(newImplementation, abi.encodeCall(upgradeToMonthlyPool, (pool, admin))).
     * @dev Refuses to run while the old contract still holds any stake. Clears the old
     *      accounting; reAED already sitting in the contract becomes surplus that the
     *      owner can recover with ownerWithdrawRewards().
     */
    function upgradeToMonthlyPool(address dividendPool_, address adminWallet_) external reinitializer(3) onlyOwner {
        require(dividendPool_ != address(0) && adminWallet_ != address(0), "zero address");
        require(totalStaked == 0 && legacyTotalLocked == 0, "Legacy stakes exist");

        legacyTotalWeight = 0;
        legacyLastGlobalUpdate = 0;
        legacyAccRewardPerWeight = 0;
        legacyRewardVaultBalance = 0;
        legacyUndistributedRewards = 0;
        legacyTotalRewarded = 0;
        legacyTotalExpired = 0;

        emit DividendPoolUpdated(dividendPool, dividendPool_);
        emit AdminWalletUpdated(adminWallet, adminWallet_);
        dividendPool = dividendPool_;
        adminWallet = adminWallet_;
        lastSyncedEpoch = currentEpoch();
        _setDefaultPeriods();
        _initAutomation();
    }

    /// @dev Fees collected from now on belong to the running month; sweeper starts here.
    function _initAutomation() internal {
        uint256 cur = currentEpoch();
        lastPulledEpoch = cur;
        nextSweepEpoch = cur;
        autoPullEnabled = true;
        emit AutoPullSet(true);
    }

    /// @dev Lock options offered on the website: 1, 2, 6, 8, 9 and 12 months.
    function _setDefaultPeriods() internal {
        uint8[6] memory d = [1, 2, 6, 8, 9, 12];
        for (uint256 i = 0; i < d.length; i++) {
            isAllowedPeriod[d[i]] = true;
            emit AllowedPeriodSet(d[i], true);
        }
    }

    /// @dev Only the owner can upgrade the implementation (UUPS).
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ════════════════════════════════════════════════════════════════════
    //  FUNDING (rewards in)
    // ════════════════════════════════════════════════════════════════════

    /**
     * @notice Entry point used by DividendPoolNativeV2.sendRewardsToStaking().
     *         The reAED sent is added to the CURRENT month's reward pool.
     */
    function fundRewardsFromDividendPool() external payable {
        _fund(currentEpoch());
    }

    /// @notice Plain transfers from the dividend pool fund the current month — except during
    ///         an auto-pull, when they are the CLOSED month's pool. Others are rejected.
    receive() external payable {
        if (_pulling && msg.sender == dividendPool) return; // booked by _autoPull()
        _fund(currentEpoch());
    }

    /**
     * @notice Runs the monthly automation: records month weights, pulls the dividend pool
     *         for the month that just closed, and sweeps expired months to the admin wallet.
     *         Anyone may call it (a daily keeper/cron does). It moves no funds anywhere else.
     */
    function poke() external nonReentrant {
        _sync();
    }

    /// @notice True if poke() would do something right now (for keepers).
    function needsPoke() external view returns (bool) {
        uint256 cur = currentEpoch();
        if (lastSyncedEpoch < cur) return true;
        if (autoPullEnabled && lastPulledEpoch < cur) return true;
        return _sweepDue(nextSweepEpoch, cur);
    }

    /// @notice Owner can add rewards to the current or a FUTURE month explicitly.
    function fundEpoch(uint256 epoch) external payable onlyOwner {
        require(epoch >= currentEpoch(), "Epoch closed");
        _fund(epoch);
    }

    /// @dev Adds msg.value to `epoch`'s reward pool. Only the dividend pool or the owner may fund.
    function _fund(uint256 epoch) internal {
        require(msg.sender == dividendPool || msg.sender == owner(), "Only dividend pool");
        require(msg.value > 0, "No reward");
        epochReward[epoch] += msg.value;
        totalRewardsReceived += msg.value;
        emit RewardsFunded(msg.sender, epoch, msg.value);
    }

    // ════════════════════════════════════════════════════════════════════
    //  STAKER ACTIONS
    // ════════════════════════════════════════════════════════════════════

    /**
     * @notice Open a new position with native reAED (send it as msg.value).
     * @param periods lock length in months, 1..MAX_PERIODS.
     * @return positionId id of the new position (per wallet).
     * @dev Earns from the start of NEXT month for exactly `periods` months.
     */
    function stake(uint256 periods) external payable nonReentrant returns (uint256 positionId) {
        require(msg.value > 0, "Amount=0");
        require(periods >= 1 && periods <= MAX_PERIODS && isAllowedPeriod[periods], "Bad periods");
        require(_positions[msg.sender].length < MAX_POSITIONS, "Too many positions");
        _sync();

        uint256 activeFrom = currentEpoch() + 1;
        uint256 lockEnd = epochStart(activeFrom + periods);

        Account storage a = accounts[msg.sender];
        positionId = a.nextId;
        a.nextId += 1;
        a.staked += msg.value;

        if (_positions[msg.sender].length == 0) stakerCount += 1;
        openPositions += 1;
        _positions[msg.sender].push(
            Position({
                amount: msg.value,
                id: uint64(positionId),
                stakedAt: uint64(block.timestamp),
                periods: uint64(periods),
                activeFrom: uint64(activeFrom),
                lockEnd: uint64(lockEnd),
                lastSettledEpoch: uint64(activeFrom - 1)
            })
        );

        scheduledActivation[activeFrom] += msg.value;
        scheduledDeactivation[activeFrom + periods] += msg.value;
        totalStaked += msg.value;

        emit Staked(msg.sender, positionId, msg.value, periods, activeFrom, lockEnd);
    }

    /**
     * @notice Claim rewards of all closed months (inside their 30-day window) across ALL
     *         of your positions. Reverts with "No rewards" if nothing is due.
     */
    function claim() external nonReentrant {
        _sync();
        uint256 paid = _settleAll(msg.sender);
        require(paid > 0, "No rewards");
    }

    /**
     * @notice Withdraw one position after its lock ended.
     * @dev Within the 30-day grace period: principal + that position's claimable rewards.
     *      After it: principal only — expired rewards go to the admin wallet via sweepExpired.
     */
    function withdraw(uint256 positionId) external nonReentrant {
        _sync();
        uint256 idx = _indexOf(msg.sender, positionId);
        _release(msg.sender, idx);
    }

    /// @notice Withdraw every position whose lock has ended. Reverts if none.
    function withdrawAll() external nonReentrant {
        _sync();
        uint256 n = _releaseEnded(msg.sender, 0);
        require(n > 0, "Lock not expired");
    }

    /**
     * @notice After lock + 30-day grace, ANYONE (admin script, keeper) may return abandoned
     *         positions to their owners. Principal always goes to the staker's own wallet.
     * @dev Skips positions still locked or inside their grace period.
     *      Reverts if a wallet rejects native transfers (remove it and retry).
     */
    function releaseStakes(address[] calldata list) external nonReentrant {
        _sync();
        for (uint256 i = 0; i < list.length; i++) {
            _releaseEnded(list[i], CLAIM_WINDOW);
        }
    }

    /**
     * @notice Send a closed month's expired (unclaimed) rewards to the ADMIN WALLET.
     *         Callable by anyone; funds only ever go to adminWallet.
     * @dev Allowed after its 30-day claim window, or immediately if that month had no
     *      stakers (total weight 0). Each month can be swept once.
     */
    function sweepExpired(uint256 epoch) external nonReentrant {
        _sync();
        require(epoch < currentEpoch(), "Epoch not closed");
        if (epochSwept[epoch]) return; // already done (possibly by the auto-sweeper)
        require(block.timestamp >= claimDeadline(epoch) || totalWeight(epoch) == 0, "Claim window open");
        require(_sweep(epoch), "Transfer failed");
    }

    // ════════════════════════════════════════════════════════════════════
    //  OWNER / ADMIN
    // ════════════════════════════════════════════════════════════════════

    /// @notice Turn auto-pull from the dividend pool on/off (on by default).
    function setAutoPull(bool enabled) external onlyOwner {
        autoPullEnabled = enabled;
        emit AutoPullSet(enabled);
    }

    /// @notice Change the dividend pool address (the only non-owner reward source).
    function setDividendPool(address newPool) external onlyOwner {
        require(newPool != address(0), "pool=0");
        emit DividendPoolUpdated(dividendPool, newPool);
        dividendPool = newPool;
    }

    /// @notice Enable or disable a lock length (1..12 months) for NEW stakes. Existing positions are unaffected.
    function setAllowedPeriod(uint256 periods, bool allowed) external onlyOwner {
        require(periods >= 1 && periods <= MAX_PERIODS, "Bad periods");
        isAllowedPeriod[periods] = allowed;
        emit AllowedPeriodSet(periods, allowed);
    }

    /// @notice Change the wallet that receives expired rewards.
    function setAdminWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "wallet=0");
        emit AdminWalletUpdated(adminWallet, newWallet);
        adminWallet = newWallet;
    }

    /**
     * @notice Withdraw REWARD funds only. Can never touch stakers' principal
     *         (limited to contract balance − totalStaked).
     * @dev This can include rewards stakers have not claimed yet; withdrawing those makes
     *      their claims fail until the pool is refunded.
     */
    function ownerWithdrawRewards(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        require(amount > 0 && amount <= surplusBalance(), "Exceeds reward balance");
        totalRewardsWithdrawnByOwner += amount;
        _send(to, amount);
        emit OwnerRewardsWithdrawn(to, amount);
    }

    /**
     * @notice EMERGENCY: withdraw ANY amount, including stakers' principal.
     * @dev Keep the owner on a multisig; stakers must trust the owner with this power.
     */
    function emergencyWithdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        require(address(this).balance >= amount, "insufficient balance");
        _send(to, amount);
        emit EmergencyWithdraw(to, amount);
    }

    // ════════════════════════════════════════════════════════════════════
    //  VIEWS (for the website and scripts)
    // ════════════════════════════════════════════════════════════════════

    /// @notice All OPEN positions of a wallet.
    function positionsOf(address user) external view returns (Position[] memory) {
        return _positions[user];
    }

    /// @notice Lock lengths currently accepted by stake(), ascending.
    function allowedPeriods() external view returns (uint256[] memory list) {
        uint256 n;
        for (uint256 p = 1; p <= MAX_PERIODS; p++) if (isAllowedPeriod[p]) n++;
        list = new uint256[](n);
        n = 0;
        for (uint256 p = 1; p <= MAX_PERIODS; p++) if (isAllowedPeriod[p]) list[n++] = p;
    }

    /// @notice Number of open positions of a wallet.
    function positionCount(address user) external view returns (uint256) {
        return _positions[user].length;
    }

    /// @notice Id of the running month (UTC).
    function currentEpoch() public view returns (uint256) {
        return epochOf(block.timestamp);
    }

    /// @notice Month id for any timestamp: year * 12 + (month - 1).
    function epochOf(uint256 timestamp) public pure returns (uint256) {
        (uint256 y, uint256 m) = _yearMonth(timestamp / 1 days);
        return y * 12 + (m - 1);
    }

    /// @notice Timestamp of the 1st of that month, 00:00 UTC.
    function epochStart(uint256 epoch) public pure returns (uint256) {
        return _daysFromCivil(epoch / 12, (epoch % 12) + 1, 1) * 1 days;
    }

    /// @notice Timestamp when the month ends (= start of the next month).
    function epochEnd(uint256 epoch) public pure returns (uint256) {
        return epochStart(epoch + 1);
    }

    /// @notice Last moment that month's rewards can be claimed (month end + 30 days).
    function claimDeadline(uint256 epoch) public pure returns (uint256) {
        return epochEnd(epoch) + CLAIM_WINDOW;
    }

    /// @notice Total weight of a month (all positions earning that month).
    function totalWeight(uint256 epoch) public view returns (uint256) {
        if (epoch <= lastSyncedEpoch) return epochBaseWeight[epoch];
        uint256 active = activeAmount;
        for (uint256 e = lastSyncedEpoch + 1; e <= epoch; e++) {
            active = active + scheduledActivation[e] - scheduledDeactivation[e];
        }
        return active * (epochEnd(epoch) - epochStart(epoch));
    }

    /// @notice A wallet's weight in a month (sum over its open positions).
    function userWeight(address user, uint256 epoch) public view returns (uint256 w) {
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) w += _positionWeight(ps[i], epoch);
    }

    /// @notice A wallet's reward from a given month across its open positions
    ///         (whether or not still claimable).
    function userEpochReward(address user, uint256 epoch) public view returns (uint256 r) {
        uint256 tw = totalWeight(epoch);
        if (tw == 0) return 0;
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) r += (rewardOf(epoch) * _positionWeight(ps[i], epoch)) / tw;
    }

    /**
     * @notice What the wallet can claim right now across all positions.
     * @return amount       total claimable from closed months inside their window
     * @return nextDeadline earliest claim deadline among those months (0 if none)
     */
    function pendingRewards(address user) public view returns (uint256 amount, uint256 nextDeadline) {
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) {
            (uint256 a, uint256 d) = _pendingOf(ps[i]);
            amount += a;
            if (d != 0 && (nextDeadline == 0 || d < nextDeadline)) nextDeadline = d;
        }
    }

    /// @notice Claimable rewards of one position (index in positionsOf).
    function pendingOfPosition(address user, uint256 index) external view returns (uint256 amount, uint256 nextDeadline) {
        return _pendingOf(_positions[user][index]);
    }

    /**
     * @notice Running-month snapshot for the UI (an estimate, not a promise).
     * @return epoch       running month id
     * @return weight      wallet's weight this month
     * @return total       total weight this month
     * @return rewardSoFar reward pool received so far this month
     */
    function currentEpochShare(address user)
        external
        view
        returns (uint256 epoch, uint256 weight, uint256 total, uint256 rewardSoFar)
    {
        epoch = currentEpoch();
        weight = userWeight(user, epoch);
        total = totalWeight(epoch);
        rewardSoFar = rewardOf(epoch);
    }

    /// @notice Everything about one month, for the cycle history table.
    function epochInfo(uint256 epoch)
        external
        view
        returns (uint256 start, uint256 end, uint256 deadline, uint256 reward, uint256 weight, uint256 claimed, bool swept)
    {
        return (
            epochStart(epoch),
            epochEnd(epoch),
            claimDeadline(epoch),
            rewardOf(epoch),
            totalWeight(epoch),
            epochClaimed[epoch],
            epochSwept[epoch]
        );
    }

    /// @notice Reward of a month INCLUDING the dividend-pool balance that the next
    ///         transaction will auto-pull into it (closed month) — what the UI should show.
    function rewardOf(uint256 epoch) public view returns (uint256) {
        return epochReward[epoch] + _unpulledFor(epoch);
    }

    function _unpulledFor(uint256 epoch) internal view returns (uint256) {
        if (!autoPullEnabled) return 0;
        uint256 cur = currentEpoch();
        // pool balance belongs to cur-1 until pulled, otherwise it is the running month's so far
        if (lastPulledEpoch < cur ? epoch == cur - 1 : epoch == cur) return dividendPool.balance;
        return 0;
    }

    /// @notice Contract balance NOT owed as principal (= reward funds, claimed or not).
    function surplusBalance() public view returns (uint256) {
        uint256 bal = address(this).balance;
        return bal > totalStaked ? bal - totalStaked : 0;
    }

    // ════════════════════════════════════════════════════════════════════
    //  INTERNALS
    // ════════════════════════════════════════════════════════════════════

    /// @dev Writes base weight of every month reached since the last sync.
    function _syncWeights() internal {
        uint256 cur = currentEpoch();
        uint256 e = lastSyncedEpoch;
        if (cur <= e) return;
        uint256 active = activeAmount;
        for (e = e + 1; e <= cur; e++) {
            active = active + scheduledActivation[e] - scheduledDeactivation[e];
            epochBaseWeight[e] = active * (epochEnd(e) - epochStart(e));
        }
        activeAmount = active;
        lastSyncedEpoch = cur;
    }

    /// @dev _sync + monthly automation (auto-pull and auto-sweep). Used by every entry point.
    function _sync() internal {
        _syncWeights();
        uint256 cur = currentEpoch();
        if (autoPullEnabled && lastPulledEpoch < cur) _autoPull(cur);
        _autoSweep(cur);
    }

    /// @dev Pulls the dividend pool's whole balance as the reward of month cur-1.
    ///      Never reverts: if the pool can't pay, the month is retried on the next call.
    function _autoPull(uint256 cur) internal {
        uint256 epoch = cur - 1;
        uint256 before = address(this).balance;
        _pulling = true;
        (bool ok, ) = dividendPool.call(abi.encodeCall(IDividendPoolPull.pullForStaking, ()));
        _pulling = false;
        uint256 got = address(this).balance - before;
        if (!ok) {
            emit AutoPulled(epoch, 0, false);
            return; // retry next call
        }
        lastPulledEpoch = cur;
        if (got > 0) {
            epochReward[epoch] += got;
            totalRewardsReceived += got;
            emit RewardsFunded(dividendPool, epoch, got);
        }
        emit AutoPulled(epoch, got, true);
    }

    /// @dev Sweeps at most 2 due months per call (bounded gas), oldest first.
    function _autoSweep(uint256 cur) internal {
        uint256 e = nextSweepEpoch;
        for (uint256 i = 0; i < 2 && e < cur; i++) {
            if (!epochSwept[e]) {
                if (!_sweepDue(e, cur)) break;
                if (!_sweep(e)) break; // admin wallet refused: retry later, never block users
            }
            e++;
        }
        nextSweepEpoch = e;
    }

    function _sweepDue(uint256 e, uint256 cur) internal view returns (bool) {
        if (e >= cur || epochSwept[e]) return e < cur;
        if (autoPullEnabled && e == cur - 1 && lastPulledEpoch < cur) return false; // not pulled yet
        return block.timestamp >= claimDeadline(e) || totalWeight(e) == 0;
    }

    /// @dev Marks `epoch` swept and sends what's left to the admin wallet. False if refused.
    function _sweep(uint256 epoch) internal returns (bool) {
        uint256 left = epochReward[epoch] - epochClaimed[epoch];
        epochSwept[epoch] = true;
        if (left == 0) return true;
        (bool ok, ) = payable(adminWallet).call{value: left, gas: 60_000}("");
        if (!ok) {
            epochSwept[epoch] = false;
            return false;
        }
        totalExpiredSwept += left;
        emit ExpiredRewardsSwept(epoch, adminWallet, left);
        return true;
    }

    /// @dev Weight of one position in one month (whole months only).
    function _positionWeight(Position storage p, uint256 epoch) internal view returns (uint256) {
        if (epoch < p.activeFrom || epoch >= uint256(p.activeFrom) + p.periods) return 0;
        return p.amount * (epochEnd(epoch) - epochStart(epoch));
    }

    /// @dev Closed earning months not yet settled for a position: [from, to]; to = max if none.
    function _range(Position storage p) internal view returns (uint256 from, uint256 to) {
        uint256 cur = currentEpoch();
        from = uint256(p.lastSettledEpoch) + 1;
        to = cur - 1;
        uint256 lastEarning = uint256(p.activeFrom) + p.periods - 1;
        if (lastEarning < to) to = lastEarning;
        if (to < from) return (1, type(uint256).max);
    }

    function _pendingOf(Position storage p) internal view returns (uint256 amount, uint256 nextDeadline) {
        (uint256 from, uint256 to) = _range(p);
        if (to == type(uint256).max) return (0, 0);
        for (uint256 e = from; e <= to; e++) {
            uint256 tw = totalWeight(e);
            if (tw == 0) continue;
            uint256 r = (rewardOf(e) * _positionWeight(p, e)) / tw;
            if (r > 0 && block.timestamp < claimDeadline(e) && !epochSwept[e]) {
                amount += r;
                if (nextDeadline == 0) nextDeadline = claimDeadline(e);
            }
        }
    }

    /// @dev Settles one position's closed months: returns (paid, expired). Does not transfer.
    function _settle(Position storage p) internal returns (uint256 paid, uint256 expired) {
        (uint256 from, uint256 to) = _range(p);
        if (to == type(uint256).max) return (0, 0);
        for (uint256 e = from; e <= to; e++) {
            uint256 tw = totalWeight(e);
            if (tw == 0) continue;
            uint256 r = (epochReward[e] * _positionWeight(p, e)) / tw;
            if (r == 0) continue;
            if (block.timestamp < claimDeadline(e) && !epochSwept[e]) {
                paid += r;
                epochClaimed[e] += r;
            } else {
                expired += r;
            }
        }
        p.lastSettledEpoch = uint64(to);
    }

    /// @dev Settles all positions of `user`, pays the total. Returns amount paid.
    function _settleAll(address user) internal returns (uint256 paid) {
        Position[] storage ps = _positions[user];
        uint256 expired;
        for (uint256 i = 0; i < ps.length; i++) {
            (uint256 pd, uint256 ex) = _settle(ps[i]);
            paid += pd;
            expired += ex;
        }
        _book(user, paid, expired);
        if (paid > 0) _send(user, paid);
    }

    /// @dev Records claimed / expired totals and emits events (no transfer).
    function _book(address user, uint256 paid, uint256 expired) internal {
        Account storage a = accounts[user];
        if (expired > 0) {
            a.totalExpired += expired;
            emit RewardsExpiredForUser(user, expired);
        }
        if (paid > 0) {
            a.totalClaimed += paid;
            totalRewardsClaimed += paid;
            emit Claimed(user, paid);
        }
    }

    /// @dev Index of a position id in the user's open positions.
    function _indexOf(address user, uint256 positionId) internal view returns (uint256) {
        Position[] storage ps = _positions[user];
        for (uint256 i = 0; i < ps.length; i++) if (ps[i].id == positionId) return i;
        revert("No stake found");
    }

    /// @dev Settles + pays one position's rewards, returns its principal, removes it (swap & pop).
    function _release(address user, uint256 idx) internal {
        Position[] storage ps = _positions[user];
        Position storage p = ps[idx];
        require(block.timestamp >= p.lockEnd, "Lock not expired");

        (uint256 paid, uint256 expired) = _settle(p);
        _book(user, paid, expired);

        uint256 amount = p.amount;
        uint256 id = p.id;
        accounts[user].staked -= amount;
        totalStaked -= amount;

        ps[idx] = ps[ps.length - 1];
        ps.pop();
        openPositions -= 1;
        if (ps.length == 0) stakerCount -= 1;

        _send(user, amount + paid);
        emit Withdrawn(user, id, amount, msg.sender);
    }

    /// @dev Releases every position of `user` whose lock ended at least `delay` ago. Returns count.
    function _releaseEnded(address user, uint256 delay) internal returns (uint256 n) {
        Position[] storage ps = _positions[user];
        uint256 i = 0;
        while (i < ps.length) {
            if (block.timestamp >= uint256(ps[i].lockEnd) + delay) {
                _release(user, i); // swap & pop: re-check the same index
                n++;
            } else {
                i++;
            }
        }
    }

    /// @dev Sends native reAED; reverts if the receiver rejects it.
    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // ── Calendar math (proleptic Gregorian, UTC) — Howard Hinnant's algorithms ──

    /// @dev Days since 1970-01-01 for a given year / month / day.
    function _daysFromCivil(uint256 y, uint256 m, uint256 d) internal pure returns (uint256) {
        if (m <= 2) y -= 1;
        uint256 era = y / 400;
        uint256 yoe = y - era * 400;
        uint256 mp = m > 2 ? m - 3 : m + 9;
        uint256 doy = (153 * mp + 2) / 5 + d - 1;
        uint256 doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    /// @dev Year and month (1..12) for a number of days since 1970-01-01.
    function _yearMonth(uint256 z) internal pure returns (uint256 y, uint256 m) {
        z += 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;
    }

    /// @dev Reserved storage slots for future upgrades (slots 32–49; previous __gap ended at 49).
    uint256[18] private __gap;
}
