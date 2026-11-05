// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import {Lockbox, IPositionManager} from "../src/Lockbox.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Tok is ERC20 { constructor() ERC20("T", "T") {} function mint(address to, uint256 a) external { _mint(to, a); } }
contract FeeTok is ERC20 {
    constructor() ERC20("F", "F") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function _update(address f, address t, uint256 a) internal override { if (f != address(0) && t != address(0)) { uint256 fee = a / 10; super._update(f, address(0), fee); a -= fee; } super._update(f, t, a); }
}
/// Minimal stand-in for the BDEX position manager: an ERC-721 whose collect() pays out fixed "fees" to the recipient.
contract MockNPM is ERC721 {
    Tok public t0; Tok public t1;
    constructor() ERC721("POS", "POS") { t0 = new Tok(); t1 = new Tok(); t0.mint(address(this), 1e24); t1.mint(address(this), 1e24); }
    function mintTo(address to, uint256 id) external { _mint(to, id); }
    function collect(IPositionManager.CollectParams calldata p) external payable returns (uint256, uint256) {
        require(ownerOf(p.tokenId) == msg.sender, "not approved");
        t0.transfer(p.recipient, 5e18); t1.transfer(p.recipient, 7e18); return (5e18, 7e18);
    }
}

contract LockboxTest is Test {
    Lockbox lb; Tok tok; address alice = address(0xA11CE); address bob = address(0xB0B); address treasury = address(0xFEE);
    uint256 constant FEE = 0.05 ether;

    function setUp() public {
        lb = new Lockbox(FEE, treasury); tok = new Tok();
        tok.mint(alice, 1000e18); vm.deal(alice, 10 ether); vm.deal(bob, 10 ether);
        vm.prank(alice); tok.approve(address(lb), type(uint256).max);
    }
    function _lock(uint256 amt, uint64 t) internal returns (uint256 id) { vm.prank(alice); id = lb.lockToken{value: FEE}(address(tok), amt, t, "team"); }

    function test_lockTokenRecordsAndTakesFee() public {
        uint256 id = _lock(400e18, uint64(block.timestamp + 30 days));
        assertEq(id, 1); assertEq(treasury.balance, FEE); assertEq(tok.balanceOf(address(lb)), 400e18);
        Lockbox.Lock memory l = lb.getLock(1);
        assertEq(l.owner, alice); assertEq(l.amount, 400e18); assertEq(l.label, "team"); assertEq(uint8(l.kind), 0);
        assertEq(lb.lockedAmount(address(tok)), 400e18); assertEq(lb.tokenLockCount(address(tok)), 1);
        assertEq(lb.lockedShareBps(address(tok)), 4000);
    }
    function test_wrongFeeAndBadTimes() public {
        vm.startPrank(alice);
        vm.expectRevert("wrong fee"); lb.lockToken{value: 0}(address(tok), 1e18, uint64(block.timestamp + 1 days), "");
        vm.expectRevert("bad unlock time"); lb.lockToken{value: FEE}(address(tok), 1e18, uint64(block.timestamp), "");
        vm.expectRevert("bad unlock time"); lb.lockToken{value: FEE}(address(tok), 1e18, uint64(block.timestamp + 101 * 365 days), "");
        vm.expectRevert("bad token"); lb.lockToken{value: FEE}(address(tok), 0, uint64(block.timestamp + 1 days), "");
        vm.expectRevert("label too long"); lb.lockToken{value: FEE}(address(tok), 1e18, uint64(block.timestamp + 1 days), "0123456789012345678901234567890123456789012345678901234567890123456789");
        vm.stopPrank();
    }
    function test_cannotWithdrawEarlyThenCan() public {
        uint256 id = _lock(100e18, uint64(block.timestamp + 10 days));
        vm.prank(alice); vm.expectRevert("still locked"); lb.withdraw(id, 100e18);
        vm.warp(block.timestamp + 10 days);
        vm.prank(bob); vm.expectRevert("not lock owner"); lb.withdraw(id, 100e18);
        vm.prank(alice); lb.withdraw(id, 30e18);
        assertEq(tok.balanceOf(alice), 930e18); assertEq(lb.getLock(id).amount, 70e18);
        vm.prank(alice); lb.withdraw(id, type(uint256).max);
        assertEq(lb.getLock(id).withdrawn, true); assertEq(lb.lockedAmount(address(tok)), 0);
        vm.prank(alice); vm.expectRevert("already withdrawn"); lb.withdraw(id, 1);
    }
    function test_extendOnlyForwardAndTopUp() public {
        uint256 id = _lock(100e18, uint64(block.timestamp + 10 days));
        vm.startPrank(alice);
        vm.expectRevert("must extend"); lb.extend(id, uint64(block.timestamp + 5 days));
        lb.extend(id, uint64(block.timestamp + 20 days));
        lb.topUp(id, 50e18);
        vm.stopPrank();
        assertEq(lb.getLock(id).amount, 150e18); assertEq(lb.getLock(id).unlockAt, block.timestamp + 20 days);
        vm.warp(block.timestamp + 10 days);
        vm.prank(alice); vm.expectRevert("still locked"); lb.withdraw(id, 1);
    }
    function test_feeOnTransferCreditsWhatArrived() public {
        FeeTok f = new FeeTok(); f.mint(alice, 100e18);
        vm.startPrank(alice); f.approve(address(lb), type(uint256).max);
        uint256 id = lb.lockToken{value: FEE}(address(f), 100e18, uint64(block.timestamp + 1 days), "");
        vm.stopPrank();
        assertEq(lb.getLock(id).amount, 90e18);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice); lb.withdraw(id, type(uint256).max); // pays out 90, receives 81 net of the token's own fee
        assertEq(f.balanceOf(address(lb)), 0);
    }
    function test_transferLock() public {
        uint256 id = _lock(10e18, uint64(block.timestamp + 1 days));
        vm.prank(alice); lb.transferLock(id, bob);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice); vm.expectRevert("not lock owner"); lb.withdraw(id, 1);
        vm.prank(bob); lb.withdraw(id, 10e18); assertEq(tok.balanceOf(bob), 10e18);
        assertEq(lb.ownerLockCount(bob), 1);
    }
    function test_positionLockCollectAndRelease() public {
        MockNPM npm = new MockNPM(); npm.mintTo(alice, 77);
        vm.startPrank(alice); npm.approve(address(lb), 77);
        uint256 id = lb.lockPosition{value: FEE}(address(npm), 77, uint64(block.timestamp + 90 days), "LP");
        vm.stopPrank();
        assertEq(npm.ownerOf(77), address(lb)); assertEq(lb.positionCount(address(npm)), 1);
        vm.prank(alice); (uint256 a0, uint256 a1) = lb.collect(id); // fees flow even while locked
        assertEq(a0, 5e18); assertEq(npm.t0().balanceOf(alice), 5e18); assertEq(npm.t1().balanceOf(alice), 7e18); assertEq(a1, 7e18);
        vm.prank(bob); vm.expectRevert("not lock owner"); lb.collect(id);
        vm.prank(alice); vm.expectRevert("still locked"); lb.withdrawPosition(id);
        vm.prank(alice); vm.expectRevert("use withdrawPosition"); lb.withdraw(id, 1);
    }
    function test_positionReleaseAfterUnlock() public {
        MockNPM npm = new MockNPM(); npm.mintTo(alice, 1);
        vm.startPrank(alice); npm.approve(address(lb), 1);
        uint256 id = lb.lockPosition{value: FEE}(address(npm), 1, uint64(block.timestamp + 1 days), "");
        vm.stopPrank();
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice); lb.withdrawPosition(id);
        assertEq(npm.ownerOf(1), alice); assertEq(lb.positionCount(address(npm)), 0);
        vm.prank(alice); vm.expectRevert("already withdrawn"); lb.withdrawPosition(id);
    }
    function test_lensPaging() public {
        for (uint256 i; i < 5; i++) _lock(1e18, uint64(block.timestamp + 1 days));
        uint256[] memory ids = lb.latest(0, 3);
        assertEq(ids.length, 3); assertEq(ids[0], 5); assertEq(ids[2], 3);
        assertEq(lb.latest(4, 10).length, 1); assertEq(lb.latest(9, 10).length, 0);
        assertEq(lb.lockCount(), 5);
    }
    function testFuzz_neverReleasesEarly(uint64 dur, uint64 wait, uint96 amt) public {
        dur = uint64(bound(dur, 1, 3000 days)); amt = uint96(bound(amt, 1, 1000e18)); wait = uint64(bound(wait, 0, dur - 1));
        uint256 id = _lock(amt, uint64(block.timestamp + dur));
        vm.warp(block.timestamp + wait);
        vm.prank(alice); vm.expectRevert("still locked"); lb.withdraw(id, amt);
    }

    // ---------------------------------------------------------------- fork: real BDEX V2 LP token and V3 position manager
    address constant WBOT = 0xD5452816194a3784dBa983426cCe7c122F4abd30;
    address constant USDT = 0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C;
    address constant V3_ROUTER = 0x07032d47A1b9f8460cBeE9dC17c1d3E438693929;
    address constant NPM = 0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090;
    address constant V2_PAIR = 0xdc7547f3cEa82C6Af7fd420656cE532C6da9b98d; // WBOT/USDT on the V2 factory
    address constant V3_POOL_3000 = 0x64F418471a1A7932a190E10da5A8551dB5AbeC05;
    struct SwapP { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
    struct MintP { address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; address recipient; uint256 deadline; }

    function _fork() internal returns (bool) {
        if (!vm.envOr("FOUNDRY_FORK", false)) return false;
        vm.createSelectFork("https://rpc.botchain.ai");
        lb = new Lockbox(FEE, treasury);
        return true;
    }
    function test_fork_lockRealV2LpToken() public {
        if (!_fork()) return;
        uint256 supply = IERC20(V2_PAIR).totalSupply(); assertGt(supply, 0);
        vm.deal(alice, 1 ether);
        deal(V2_PAIR, alice, supply / 10);
        vm.startPrank(alice); IERC20(V2_PAIR).approve(address(lb), type(uint256).max);
        uint256 id = lb.lockToken{value: FEE}(V2_PAIR, supply / 10, uint64(block.timestamp + 365 days), "WBOT/USDT LP");
        vm.stopPrank();
        assertGt(lb.lockedShareBps(V2_PAIR), 900);
        vm.warp(block.timestamp + 365 days);
        vm.prank(alice); lb.withdraw(id, type(uint256).max);
        assertEq(IERC20(V2_PAIR).balanceOf(alice), supply / 10);
    }
    function test_fork_lockRealV3PositionCollectsFeesWhileLocked() public {
        if (!_fork()) return;
        vm.deal(alice, 200 ether);
        vm.startPrank(alice);
        (bool ok,) = WBOT.call{value: 60 ether}(abi.encodeWithSignature("deposit()")); require(ok);
        IERC20(WBOT).approve(V3_ROUTER, type(uint256).max); IERC20(USDT).approve(V3_ROUTER, type(uint256).max);
        // get some USDT through BDEX V3 (1% pool tier 3000 exists for WBOT/USDT)
        (bool s,) = V3_ROUTER.call(abi.encodeWithSelector(0x414bf389, SwapP(WBOT, USDT, 3000, alice, block.timestamp + 600, 20 ether, 0, 0)));
        require(s, "swap failed");
        (bool g, bytes memory slot0) = V3_POOL_3000.staticcall(abi.encodeWithSignature("slot0()"));
        require(g); (, int24 tick) = abi.decode(slot0, (uint160, int24));
        int24 spacing = 60; int24 lo = (tick / spacing) * spacing - 600; int24 hi = (tick / spacing) * spacing + 600;
        IERC20(WBOT).approve(NPM, type(uint256).max); IERC20(USDT).approve(NPM, type(uint256).max);
        uint256 usdt = IERC20(USDT).balanceOf(alice);
        (bool m, bytes memory ret) = NPM.call(abi.encodeWithSelector(0x88316456, MintP(USDT, WBOT, 3000, lo, hi, usdt, 20 ether, 0, 0, alice, block.timestamp + 600)));
        require(m, "mint failed");
        (uint256 tokenId,,,) = abi.decode(ret, (uint256, uint128, uint256, uint256));
        IERC721Like(NPM).approve(address(lb), tokenId);
        uint256 id = lb.lockPosition{value: FEE}(NPM, tokenId, uint64(block.timestamp + 180 days), "my LP");
        assertEq(IERC721Like(NPM).ownerOf(tokenId), address(lb));
        // trade through the pool both ways so the position earns fees
        for (uint256 i; i < 3; i++) {
            (bool s1,) = V3_ROUTER.call(abi.encodeWithSelector(0x414bf389, SwapP(WBOT, USDT, 3000, alice, block.timestamp + 600, 2 ether, 0, 0))); require(s1, "swap a");
            uint256 u = IERC20(USDT).balanceOf(alice);
            (bool s2,) = V3_ROUTER.call(abi.encodeWithSelector(0x414bf389, SwapP(USDT, WBOT, 3000, alice, block.timestamp + 600, u / 2, 0, 0))); require(s2, "swap b");
        }
        uint256 w0 = IERC20(WBOT).balanceOf(alice); uint256 u0 = IERC20(USDT).balanceOf(alice);
        (uint256 a0, uint256 a1) = lb.collect(id);
        assertGt(a0 + a1, 0, "no fees");
        assertEq(IERC20(USDT).balanceOf(alice) - u0, a0); assertEq(IERC20(WBOT).balanceOf(alice) - w0, a1);
        vm.expectRevert("still locked"); lb.withdrawPosition(id);
        vm.warp(block.timestamp + 180 days);
        lb.withdrawPosition(id);
        assertEq(IERC721Like(NPM).ownerOf(tokenId), alice);
        vm.stopPrank();
    }
}
interface IERC721Like { function approve(address, uint256) external; function ownerOf(uint256) external view returns (address); }
