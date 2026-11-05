// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev The one function of a Uniswap-V3-style position manager Lockbox ever calls (BDEX: 0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090).
interface IPositionManager {
    struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }
    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
}

/// @notice Lockbox: lock ERC-20s, BDEX V2 LP tokens and BDEX V3 position NFTs until a date, with a public record for every lock.
/// - Locks can only be extended, never shortened. Nobody (not even the deployer) can unlock early: there is no admin path to funds.
/// - A locked V3 position keeps earning: its owner can `collect` fees any time. Lockbox has no way to remove liquidity.
/// - The lock owner can hand the lock to another address (for example when selling a locked position).
/// - Fee: a flat `fee` in BOT per new lock, paid straight to `feeRecipient`. Both are immutable.
contract Lockbox is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Kind { TOKEN, POSITION }
    struct Lock {
        Kind kind;
        address token;     // ERC-20 / V2 LP token, or the position-manager (ERC-721) contract
        address owner;     // who can extend, withdraw, collect or transfer the lock
        uint256 amount;    // ERC-20 amount still locked, or the NFT id for a POSITION
        uint64 unlockAt;
        uint64 createdAt;
        bool withdrawn;    // POSITION: NFT released. TOKEN: amount reached zero
        string label;
    }

    uint256 public constant MAX_LOCK = 100 * 365 days;
    uint256 public constant MAX_LABEL = 64;
    uint256 public immutable fee;
    address public immutable feeRecipient;

    Lock[] private _locks; // id = index + 1
    mapping(address => uint256[]) private _byToken;
    mapping(address => uint256[]) private _byOwner;
    mapping(address => uint256) public lockedAmount; // total ERC-20 amount currently locked per token
    mapping(address => uint256) public positionCount; // active locked positions per manager

    event Locked(uint256 indexed id, Kind kind, address indexed token, address indexed owner, uint256 amountOrId, uint64 unlockAt, string label);
    event Extended(uint256 indexed id, uint64 unlockAt);
    event ToppedUp(uint256 indexed id, uint256 added, uint256 newAmount);
    event Withdrawn(uint256 indexed id, address indexed to, uint256 amountOrId);
    event LockTransferred(uint256 indexed id, address indexed from, address indexed to);
    event FeesCollected(uint256 indexed id, address indexed to, uint256 amount0, uint256 amount1);

    constructor(uint256 fee_, address feeRecipient_) {
        require(fee_ <= 1 ether && feeRecipient_ != address(0), "bad config");
        fee = fee_; feeRecipient = feeRecipient_;
    }

    // ------------------------------------------------------------------ create
    /// @notice Lock `amount` of an ERC-20 or V2 LP token. Approve Lockbox first. Credits what actually arrived.
    function lockToken(address token, uint256 amount, uint64 unlockAt, string calldata label) external payable nonReentrant returns (uint256 id) {
        require(token != address(0) && amount > 0, "bad token");
        _checkTime(unlockAt); _takeFee();
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 got = IERC20(token).balanceOf(address(this)) - before;
        require(got > 0, "nothing received");
        lockedAmount[token] += got;
        id = _add(Kind.TOKEN, token, got, unlockAt, label);
    }

    /// @notice Lock a V3 position NFT. Approve Lockbox for the NFT first (or `setApprovalForAll`).
    function lockPosition(address manager, uint256 tokenId, uint64 unlockAt, string calldata label) external payable nonReentrant returns (uint256 id) {
        require(manager != address(0), "bad manager");
        _checkTime(unlockAt); _takeFee();
        IERC721(manager).transferFrom(msg.sender, address(this), tokenId);
        require(IERC721(manager).ownerOf(tokenId) == address(this), "not received");
        positionCount[manager]++;
        id = _add(Kind.POSITION, manager, tokenId, unlockAt, label);
    }

    function _add(Kind kind, address token, uint256 amountOrId, uint64 unlockAt, string calldata label) private returns (uint256 id) {
        require(bytes(label).length <= MAX_LABEL, "label too long");
        _locks.push(Lock(kind, token, msg.sender, amountOrId, unlockAt, uint64(block.timestamp), false, label));
        id = _locks.length;
        _byToken[token].push(id); _byOwner[msg.sender].push(id);
        emit Locked(id, kind, token, msg.sender, amountOrId, unlockAt, label);
    }
    function _checkTime(uint64 unlockAt) private view {
        require(unlockAt > block.timestamp && unlockAt <= block.timestamp + MAX_LOCK, "bad unlock time");
    }
    function _takeFee() private {
        require(msg.value == fee, "wrong fee");
        if (fee > 0) { (bool ok,) = feeRecipient.call{value: fee}(""); require(ok, "fee failed"); }
    }

    // ------------------------------------------------------------------ manage
    function _mine(uint256 id) private view returns (Lock storage l) {
        require(id > 0 && id <= _locks.length, "no such lock");
        l = _locks[id - 1];
        require(l.owner == msg.sender, "not lock owner");
        require(!l.withdrawn, "already withdrawn");
    }

    /// @notice Push the unlock date later. It can never move earlier.
    function extend(uint256 id, uint64 newUnlockAt) external {
        Lock storage l = _mine(id);
        require(newUnlockAt > l.unlockAt && newUnlockAt <= block.timestamp + MAX_LOCK, "must extend");
        l.unlockAt = newUnlockAt;
        emit Extended(id, newUnlockAt);
    }

    /// @notice Add more tokens to an existing TOKEN lock (same unlock date).
    function topUp(uint256 id, uint256 amount) external nonReentrant {
        Lock storage l = _mine(id);
        require(l.kind == Kind.TOKEN && amount > 0, "not a token lock");
        uint256 before = IERC20(l.token).balanceOf(address(this));
        IERC20(l.token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 got = IERC20(l.token).balanceOf(address(this)) - before;
        l.amount += got; lockedAmount[l.token] += got;
        emit ToppedUp(id, got, l.amount);
    }

    /// @notice After the unlock date, take back `amount` of a TOKEN lock (use `type(uint256).max` for everything).
    function withdraw(uint256 id, uint256 amount) external nonReentrant {
        Lock storage l = _mine(id);
        require(l.kind == Kind.TOKEN, "use withdrawPosition");
        require(block.timestamp >= l.unlockAt, "still locked");
        if (amount > l.amount) amount = l.amount;
        require(amount > 0, "nothing to withdraw");
        l.amount -= amount; lockedAmount[l.token] -= amount;
        if (l.amount == 0) l.withdrawn = true;
        IERC20(l.token).safeTransfer(msg.sender, amount);
        emit Withdrawn(id, msg.sender, amount);
    }

    /// @notice After the unlock date, take the position NFT back.
    function withdrawPosition(uint256 id) external nonReentrant {
        Lock storage l = _mine(id);
        require(l.kind == Kind.POSITION, "use withdraw");
        require(block.timestamp >= l.unlockAt, "still locked");
        l.withdrawn = true; positionCount[l.token]--;
        IERC721(l.token).transferFrom(address(this), msg.sender, l.amount);
        emit Withdrawn(id, msg.sender, l.amount);
    }

    /// @notice Collect a locked position's trading fees to the lock owner. Allowed at any time; liquidity stays locked.
    function collect(uint256 id) external nonReentrant returns (uint256 a0, uint256 a1) {
        Lock storage l = _mine(id);
        require(l.kind == Kind.POSITION, "not a position");
        (a0, a1) = IPositionManager(l.token).collect(IPositionManager.CollectParams(l.amount, msg.sender, type(uint128).max, type(uint128).max));
        emit FeesCollected(id, msg.sender, a0, a1);
    }

    /// @notice Give the lock (and the right to withdraw / collect) to someone else.
    function transferLock(uint256 id, address to) external {
        Lock storage l = _mine(id);
        require(to != address(0) && to != l.owner, "bad recipient");
        emit LockTransferred(id, l.owner, to);
        l.owner = to; _byOwner[to].push(id);
    }

    // ------------------------------------------------------------------ views (the public lock pages read these)
    function lockCount() external view returns (uint256) { return _locks.length; }
    function getLock(uint256 id) external view returns (Lock memory) { require(id > 0 && id <= _locks.length, "no such lock"); return _locks[id - 1]; }
    function idsByToken(address token) external view returns (uint256[] memory) { return _byToken[token]; }
    /// @dev Includes locks that were later transferred away; callers filter by `getLock(id).owner`.
    function idsByOwner(address owner) external view returns (uint256[] memory) { return _byOwner[owner]; }
    function tokenLockCount(address token) external view returns (uint256) { return _byToken[token].length; }
    function ownerLockCount(address owner) external view returns (uint256) { return _byOwner[owner].length; }

    /// @notice Newest-first page of lock ids for the board.
    function latest(uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256 n = _locks.length;
        if (offset >= n) return new uint256[](0);
        uint256 count = n - offset < limit ? n - offset : limit;
        ids = new uint256[](count);
        for (uint256 i; i < count; i++) ids[i] = n - offset - i;
    }
    /// @notice Share of `token`'s total supply that is locked here, in basis points (for LP tokens this is the share of the pool).
    function lockedShareBps(address token) external view returns (uint256) {
        uint256 supply = IERC20(token).totalSupply();
        return supply == 0 ? 0 : lockedAmount[token] * 10_000 / supply;
    }
}
