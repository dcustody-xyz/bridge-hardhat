// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./CCIPBase.sol";
import "hardhat/console.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title - A simple messenger contract for transferring/receiving tokens and data across chains.
contract Receiver is CCIPBase {
    using SafeERC20 for IERC20;

    // Custom errors to provide more descriptive revert messages.
    error SwapperFailed();
    error LessThanExpected(uint _expected, uint _current);
    error NothingToWithdraw(); // Used when trying to withdraw Ether but there's nothing to withdraw.
    error FailedToWithdraw(address owner, uint256 value); // Used when the withdrawal of Ether fails.
    error SourceNotWhitelisted(uint64 chainSelector, address sender); // Used when the source chain has not been whitelisted by the contract owner.

    // Event emitted when a message is received from another chain.
    event MessageReceived(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed chainSelector, // The chain selector of the source chain.
        address sender, // The address of the sender from the source chain.
        address dest,
        address token, // The token address that was transferred.
        uint256 tokenAmount // The token amount that was transferred.
    );
    event SwapperChanged(address _oldSwapper, address _oldSwapperApprover, address _newSwapper, address _newSwapperApprover);

    bytes32 private lastReceivedMessageId; // Store the last received messageId.
    address private lastReceivedTokenAddress; // Store the last received token address.
    uint256 private lastReceivedTokenAmount; // Store the last received amount.
    bytes private lastReceivedData; // Store the last received data.

    // Mapping to keep track of whitelisted source chains.
    mapping(uint64 => mapping(address => bool)) public whitelistedSources;

    address public swapper;
    address public swapperApprover;

    constructor(address _router, address _link) CCIPBase(_router, _link) { }

    /// @dev Modifier that checks if the chain with the given chainSelector is whitelisted.
    /// @param _chainSelector The selector of the destination chain.
    modifier onlyWhitelisted(uint64 _chainSelector, address _sender) {
        if (!whitelistedSources[_chainSelector][_sender])
            revert SourceNotWhitelisted(_chainSelector, _sender);
        _;
    }

    /// @dev Whitelists a chain for transactions.
    /// @notice This function can only be called by the owner.
    /// @param _chainSelector The selector of the source chain to be whitelisted.
    function whitelistSource(uint64 _chainSelector, address _sender) external onlyOwner {
        whitelistedSources[_chainSelector][_sender] = true;
    }

    /// @dev Denylists a chain for transactions.
    /// @notice This function can only be called by the owner.
    /// @param _chainSelector The selector of the source chain to be denylisted.
    function denylistSource(uint64 _chainSelector, address _sender) external onlyOwner {
        whitelistedSources[_chainSelector][_sender] = false;
    }

    /**
     * @notice Returns the details of the last CCIP received message.
     * @dev This function retrieves the ID, data, token address, and token amount of the last received CCIP message.
     * @return messageId The ID of the last received CCIP message.
     * @return data The data of the last received CCIP message.
     * @return tokenAddress The address of the token in the last CCIP received message.
     * @return tokenAmount The amount of the token in the last CCIP received message.
     */
    function getLastReceivedMessageDetails()
        public
        view
        returns (
            bytes32 messageId,
            bytes memory data,
            address tokenAddress,
            uint256 tokenAmount
        )
    {
        return (
            lastReceivedMessageId,
            lastReceivedData,
            lastReceivedTokenAddress,
            lastReceivedTokenAmount
        );
    }

    function setSwapper(address _swapper, address _swapperApprover) external onlyOwner {
        emit SwapperChanged(swapper, swapperApprover,  _swapper, _swapperApprover);

        swapper = _swapper;
        swapperApprover = _swapperApprover;
    }

    /// handle a received message
    function _ccipReceive(
        Client.Any2EVMMessage memory any2EvmMessage
    )
        internal
        override
        onlyWhitelisted(any2EvmMessage.sourceChainSelector, abi.decode(any2EvmMessage.sender, (address)))
    {
        lastReceivedMessageId = any2EvmMessage.messageId; // fetch the messageId
        (
            address dest, address destToken, uint destMinAmount, bytes memory _swapperData
        ) = abi.decode(any2EvmMessage.data, (address, address, uint, bytes)); // abi-decoding of the sent data

        IERC20 _expToken = IERC20(destToken);
        uint _bal = _expToken.balanceOf(address(this));

        if (_swapperData.length > 0) {
            // Can be own swapper or paraswap or any other
            IERC20(any2EvmMessage.destTokenAmounts[0].token).safeApprove(
                swapperApprover, any2EvmMessage.destTokenAmounts[0].amount
            );
            (bool success, ) = swapper.call(_swapperData);

            if (!success) revert SwapperFailed();
        }

        uint diff = _expToken.balanceOf(address(this)) - _bal;

        if (diff < destMinAmount) { revert LessThanExpected(destMinAmount, diff); }

        _expToken.safeTransfer(dest, diff);

        emit MessageReceived(
            any2EvmMessage.messageId,
            any2EvmMessage.sourceChainSelector, // fetch the source chain identifier (aka selector)
            abi.decode(any2EvmMessage.sender, (address)), // abi-decoding of the sender address,
            dest,
            destToken,
            destMinAmount
        );
    }

    /// @notice Fallback function to allow the contract to receive Ether.
    /// @dev This function has no function body, making it a default function for receiving Ether.
    /// It is automatically called when Ether is sent to the contract without any data.
    receive() external payable {}

    /// @notice Allows the contract owner to withdraw the entire balance of Ether from the contract.
    /// @dev This function reverts if there are no funds to withdraw or if the transfer fails.
    /// It should only be callable by the owner of the contract.
    function withdraw() external onlyOwner {
        // Retrieve the balance of this contract
        uint256 amount = address(this).balance;

        // Revert if there is nothing to withdraw
        if (amount == 0) revert NothingToWithdraw();

        // Attempt to send the funds, capturing the success status and discarding any return data
        (bool sent, ) = msg.sender.call{value: amount}("");

        // Revert if the send failed, with information about the attempted transfer
        if (!sent) revert FailedToWithdraw(msg.sender, amount);
    }

    /// @notice Allows the owner of the contract to withdraw all tokens of a specific ERC20 token.
    /// @dev This function reverts with a 'NothingToWithdraw' error if there are no tokens to withdraw.
    /// @param _token The contract address of the ERC20 token to be withdrawn.
    function withdrawToken(address _token) external onlyOwner {
        // Retrieve the balance of this contract
        uint256 amount = IERC20(_token).balanceOf(address(this));

        // Revert if there is nothing to withdraw
        if (amount == 0) revert NothingToWithdraw();

        IERC20(_token).safeTransfer(msg.sender, amount);
    }
}
