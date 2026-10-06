// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Fixed-rate ETH sale with outcome escrow. No milestone arbitration or admin upgrades.
contract GenesisSale is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    address public immutable creator;
    uint256 public immutable tokensPerEth;
    uint256 public immutable softCap;
    uint256 public immutable hardCap;
    uint256 public immutable start;
    uint256 public immutable end;
    uint256 public raised;
    uint256 public unclaimedTokens;
    bool public funded;
    bool public finalized;
    bool public successful;
    bool public proceedsClaimed;
    mapping(address => uint256) public contributions;
    event Funded(uint256 tokens);
    event Contribution(address indexed buyer, uint256 eth);
    event Finalized(bool successful);
    event Claimed(address indexed buyer, uint256 tokens);
    event Refunded(address indexed buyer, uint256 eth);
    event ProceedsWithdrawn(uint256 eth);

    constructor(address token_, uint256 rate_, uint256 soft_, uint256 hard_, uint256 start_, uint256 end_) {
        require(token_.code.length > 0 && rate_ > 0 && rate_ <= 1e12, "Invalid token/rate");
        require(soft_ > 0 && hard_ >= soft_ && hard_ <= 1e24, "Invalid caps");
        require(start_ > block.timestamp && end_ > start_ && end_ <= block.timestamp + 365 days, "Invalid dates");
        token = IERC20(token_); creator = msg.sender; tokensPerEth = rate_;
        softCap = soft_; hardCap = hard_; start = start_; end = end_;
        require(hard_ * rate_ <= IERC20(token_).totalSupply(), "Insufficient total supply");
    }
    modifier onlyCreator() { require(msg.sender == creator, "Creator only"); _; }
    function fund() external onlyCreator nonReentrant {
        require(!funded && !finalized && block.timestamp < start, "Funding closed");
        uint256 amount = hardCap * tokensPerEth;
        funded = true;
        token.safeTransferFrom(msg.sender, address(this), amount);
        require(token.balanceOf(address(this)) >= amount, "Inventory missing");
        emit Funded(amount);
    }
    function buy() external payable nonReentrant {
        require(funded && !finalized && block.timestamp >= start && block.timestamp < end, "Sale not open");
        require(msg.value > 0 && raised + msg.value <= hardCap, "Contribution exceeds cap");
        contributions[msg.sender] += msg.value; raised += msg.value;
        emit Contribution(msg.sender, msg.value);
    }
    function finalize() external {
        require(!finalized && (block.timestamp >= end || raised == hardCap), "Not ready");
        finalized = true; successful = funded && raised >= softCap;
        if (successful) unclaimedTokens = raised * tokensPerEth;
        emit Finalized(successful);
    }
    function cancelBeforeStart() external onlyCreator {
        require(!finalized && block.timestamp < start, "Cancellation closed");
        finalized = true; emit Finalized(false);
    }
    function claimTokens() external nonReentrant {
        require(finalized && successful, "No token claims");
        uint256 amount = contributions[msg.sender] * tokensPerEth;
        require(amount > 0, "Nothing to claim");
        contributions[msg.sender] = 0; unclaimedTokens -= amount;
        token.safeTransfer(msg.sender, amount); emit Claimed(msg.sender, amount);
    }
    function refund() external nonReentrant {
        require(finalized && !successful, "No refunds");
        uint256 amount = contributions[msg.sender]; require(amount > 0, "Nothing to refund");
        contributions[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}(""); require(ok, "ETH transfer failed");
        emit Refunded(msg.sender, amount);
    }
    function withdrawProceeds() external onlyCreator nonReentrant {
        require(finalized && successful && !proceedsClaimed, "No proceeds");
        proceedsClaimed = true;
        (bool ok,) = creator.call{value: raised}(""); require(ok, "ETH transfer failed");
        emit ProceedsWithdrawn(raised);
    }
    function recoverUnsoldTokens() external onlyCreator nonReentrant {
        require(finalized, "Sale not finalized");
        uint256 amount = token.balanceOf(address(this)) - unclaimedTokens;
        require(amount > 0, "Nothing to recover"); token.safeTransfer(creator, amount);
    }
}
